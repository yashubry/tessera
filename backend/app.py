# app.py
from flask import Flask, jsonify, request, make_response
import os
import json
import string
import sqlite3
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import stripe
load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # backend/ folder
DB_PATH = os.path.abspath(os.path.join(BASE_DIR, "..", "database", "tessera.db"))

from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
)

import stripe

# -----------------------------------------------------------------------------
# App / CORS / JWT / Stripe
# -----------------------------------------------------------------------------
app = Flask(__name__)

# Liberal CORS for local dev
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

@app.after_request
def add_cors_headers(resp):
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    resp.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
    return resp

app.config["JWT_SECRET_KEY"] = "imsohungryhelp"  # change in production
jwt = JWTManager(app)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

def _safe_username_seed(email: str, fallback: str = "user"):
    base = (email.split("@")[0] if email and "@" in email else fallback).strip()
    base = "".join(ch for ch in base if ch.isalnum() or ch in ("_", "-")) or fallback
    return base[:24]

def _ensure_unique_username(cur, seed: str) -> str:
    u = seed
    suffix = 0
    while True:
        row = cur.execute("SELECT 1 FROM Users WHERE username = ?", (u,)).fetchone()
        if not row:
            return u
        suffix += 1
        u = f"{seed}{suffix}"


# -----------------------------------------------------------------------------
# DB helpers
# -----------------------------------------------------------------------------
def get_db_connection():
    # Adjust path to your repo structure as needed
    db_path = os.path.abspath("../database/tessera.db")
    print(f"Using database at: {db_path}")
    conn = sqlite3.connect(db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn

# -----------------------------------------------------------------------------
# Small utils
# -----------------------------------------------------------------------------
def normalize_seats(seats):
    """Ensure seats look like [{'row':'A','seat':1},...] with correct types."""
    out = []
    for s in seats or []:
        out.append({"row": str(s["row"]), "seat": int(s["seat"])})
    return out

def is_admin_user(user_id: int) -> bool:
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT email FROM Users WHERE user_id = ?", (user_id,))
            row = cur.fetchone()
            return bool(row) and str(row["email"]).strip().lower() == "yashu.bry04@gmail.com"
    except Exception:
        return False

def compute_amount_cents(event_id: int, seats):
    """
    Recomputes total from DB. Requires every seat to exist and be RESERVED.
    Returns (amount_cents, normalized_seats).
    """
    seats = normalize_seats(seats)
    total = 0.0
    with get_db_connection() as conn:
        cur = conn.cursor()
        for s in seats:
            row, seat = s["row"], s["seat"]
            rec = cur.execute(
                """
                SELECT t.status, COALESCE(pc.base_price, 0) AS base_price
                  FROM Tickets t
                  LEFT JOIN PriceCodes pc ON pc.price_code_id = t.price_code_id
                 WHERE t.event_id=? AND t.row_name=? AND t.seat_number=?
                """,
                (event_id, row, seat),
            ).fetchone()
            if not rec:
                raise ValueError(f"Seat {row}{seat} does not exist")
            if rec["status"] != "RESERVED":
                raise ValueError(f"Seat {row}{seat} not reserved")
            total += float(rec["base_price"])
    return int(round(total * 100)), seats

def utc_now():
    return datetime.now(timezone.utc)

def iso(dt: datetime):
    return dt.replace(microsecond=0).isoformat()

def normalize_date(s: str) -> str:
    s = (s or "").strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    raise ValueError("Invalid date")

def normalize_time(s: str) -> str:
    s = (s or "").strip()
    for fmt in ("%H:%M", "%I:%M %p"):
        try:
            return datetime.strptime(s, fmt).time().strftime("%H:%M")
        except ValueError:
            pass
    raise ValueError("Invalid time")

@app.post("/auth/google")
def google_auth():
    """
    Body: { "id_token": "<google id token from @react-oauth/google GoogleLogin>" }
    - Verifies with Google
    - Upserts user in Users table (random password hash to satisfy schema)
    - Returns our app JWT: { access_token }
    """
    data = request.get_json(silent=True) or {}
    id_token = data.get("id_token")
    if not id_token:
        return jsonify({"error": "Missing id_token"}), 400

    # Verify ID token using Google's tokeninfo (simple; production can use google-auth verify_oauth2_token)
    try:
        r = requests.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": id_token}, timeout=6)
        info = r.json()
        if r.status_code != 200:
            return jsonify({"error": "Invalid Google token"}), 401

        aud = info.get("aud")
        email = (info.get("email") or "").strip().lower()
        email_verified = info.get("email_verified") in ("true", True)
        name = info.get("name") or ""
        if GOOGLE_CLIENT_ID and aud != GOOGLE_CLIENT_ID:
            return jsonify({"error": "Token audience mismatch"}), 401
        if not email or not email_verified:
            return jsonify({"error": "Email not verified on Google account"}), 401

        # Upsert user
        with get_db_connection() as conn:
            cur = conn.cursor()
            row = cur.execute("SELECT user_id FROM Users WHERE email = ?", (email,)).fetchone()
            if row:
                user_id = row["user_id"]
            else:
                # create a username (unique) + random password (hashed)
                seed = _safe_username_seed(email, "user")
                username = _ensure_unique_username(cur, seed)
                random_pw = secrets.token_urlsafe(24)
                pw_hash = generate_password_hash(random_pw)
                cur.execute(
                    "INSERT INTO Users (email, username, password_hash) VALUES (?, ?, ?)",
                    (email, username, pw_hash),
                )
                conn.commit()
                user_id = cur.lastrowid

        # mint our JWT (identity = user_id as string, to match your existing code)
        access_token = create_access_token(identity=str(user_id), expires_delta=timedelta(hours=1))
        return jsonify({"access_token": access_token}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# -----------------------------------------------------------------------------
# Admin: create event (optional) + generate tickets
# -----------------------------------------------------------------------------
@app.route("/admin/events", methods=["POST", "OPTIONS"])
@jwt_required(optional=True)
def admin_create_event():
    if request.method == "OPTIONS":
        return ("", 204)

    user_id = get_jwt_identity()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    if not is_admin_user(int(user_id)):
        return jsonify({"error": "Admin only"}), 403

    data = request.get_json(silent=True) or {}
    try:
        name = data["name"].strip()
        description = (data.get("description") or "").strip()
        date_iso = normalize_date(data["date"])
        time_24 = normalize_time(data["time"])
        location = data["location"].strip()
        image_url = (data.get("image_url") or "").strip()
    except (KeyError, ValueError) as e:
        return jsonify({"error": f"Invalid input: {e}"}), 400

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO Events (name, description, date, time, location, image_url)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (name, description, date_iso, time_24, location, image_url),
            )
            event_id = cur.lastrowid
            conn.commit()
        return jsonify({"event_id": event_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/events/<int:event_id>/tickets/generate", methods=["POST", "OPTIONS"])
@jwt_required(optional=True)
def admin_generate_tickets(event_id):
    if request.method == "OPTIONS":
        return ("", 204)

    user_id = get_jwt_identity()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    if not is_admin_user(int(user_id)):
        return jsonify({"error": "Admin only"}), 403

    data = request.get_json(silent=True) or {}
    try:
        num_rows = int(data.get("num_rows", 0))
        seats_per_row = int(data.get("seats_per_row", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "num_rows and seats_per_row must be integers"}), 400

    if num_rows < 1 or seats_per_row < 1:
        return jsonify({"error": "num_rows and seats_per_row must be >= 1"}), 400
    if num_rows > 26:
        return jsonify({"error": "Supports up to 26 rows (A..Z)"}), 400

    premium_rows = {
        str(r).strip().upper()
        for r in (data.get("premium_rows") or [])
        if str(r).strip()
    }
    default_pcid = int(data.get("default_price_code_id", 1))
    premium_pcid = int(data.get("premium_price_code_id", 2))

    labels = list(string.ascii_uppercase[:num_rows])

    inserted = 0
    skipped = 0

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("BEGIN IMMEDIATE")

            # ensure event exists
            if not cur.execute(
                "SELECT 1 FROM Events WHERE event_id = ?",
                (event_id,),
            ).fetchone():
                conn.rollback()
                return jsonify({"error": f"Event {event_id} not found"}), 404

            for r in labels:
                pcid = premium_pcid if r in premium_rows else default_pcid
                for seat in range(1, seats_per_row + 1):
                    exists = cur.execute(
                        """
                        SELECT 1 FROM Tickets
                        WHERE event_id=? AND row_name=? AND seat_number=?
                        """,
                        (event_id, r, seat),
                    ).fetchone()
                    if exists:
                        skipped += 1
                        continue

                    cur.execute(
                        """
                        INSERT INTO Tickets (event_id, row_name, seat_number, status, price_code_id)
                        VALUES (?, ?, ?, 'AVAILABLE', ?)
                        """,
                        (event_id, r, seat, pcid),
                    )
                    inserted += 1

            conn.commit()

        return jsonify(
            {
                "message": "Tickets generated",
                "event_id": event_id,
                "rows": labels,
                "seats_per_row": seats_per_row,
                "inserted": inserted,
                "skipped_existing": skipped,
            }
        ), 200

    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        return jsonify({"error": str(e)}), 500

# -----------------------------------------------------------------------------
# Events list
# -----------------------------------------------------------------------------
@app.route("/events", methods=["GET"])
def get_events():
    query = "SELECT * FROM Events"
    params = []

    after_date = request.args.get("afterDate")
    location = request.args.get("location")

    if after_date and location:
        query += " WHERE date > ? AND location = ?"
        params.extend([after_date, location])
    elif after_date:
        query += " WHERE date > ?"
        params.append(after_date)
    elif location:
        query += " WHERE location = ?"
        params.append(location)

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            events = cursor.fetchall()
            return jsonify([dict(e) for e in events]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -----------------------------------------------------------------------------
# Users: create, login, profile, change password
# -----------------------------------------------------------------------------
@app.route("/user", methods=["POST"])
def create_user():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    username = data.get("username")
    password = data.get("password")

    if not email or not username or not password:
        return jsonify({"error": "email, username, password are required"}), 400

    hashed = generate_password_hash(password)

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO Users (email, username, password_hash) VALUES (?, ?, ?)",
                (email, username, hashed),
            )
            conn.commit()
            uid = cur.execute(
                "SELECT user_id FROM Users WHERE username=?",
                (username,),
            ).fetchone()["user_id"]
        return jsonify({"message": "User created", "user_id": uid}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username or email already exists"}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "All fields are required"}), 400

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            row = cur.execute(
                "SELECT user_id, username, password_hash FROM Users WHERE username=?",
                (username,),
            ).fetchone()
            if not row:
                return jsonify({"error": "Invalid username or password"}), 401
            if not check_password_hash(row["password_hash"], password):
                return jsonify({"error": "Invalid username or password"}), 401

            token = create_access_token(identity=str(row["user_id"]), expires_delta=timedelta(hours=1))
            return jsonify({"message": "Login successful", "access_token": token}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/user/profile", methods=["GET"])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    with get_db_connection() as conn:
        user = conn.execute(
            "SELECT username, email FROM Users WHERE user_id=?",
            (user_id,),
        ).fetchone()
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"username": user["username"], "email": user["email"]})


@app.route("/user/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    email = data.get("email")

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE Users
                   SET username = COALESCE(?, username),
                       email    = COALESCE(?, email)
                 WHERE user_id = ?
                """,
                (username, email, user_id),
            )
            conn.commit()
        return jsonify({"message": "Profile updated"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/user/password", methods=["PUT"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    current_password = data.get("password")
    new_password = data.get("new_password")

    if not current_password or not new_password:
        return jsonify({"error": "password and new_password are required"}), 400
    if current_password == new_password:
        return jsonify({"error": "New password must be different"}), 400

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            row = cur.execute(
                "SELECT password_hash FROM Users WHERE user_id=?",
                (user_id,),
            ).fetchone()
            if not row:
                return jsonify({"error": "User not found"}), 404
            if not check_password_hash(row["password_hash"], current_password):
                return jsonify({"error": "Incorrect current password"}), 401

            cur.execute(
                "UPDATE Users SET password_hash=? WHERE user_id=?",
                (generate_password_hash(new_password), user_id),
            )
            conn.commit()
        return jsonify({"message": "Password updated"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -----------------------------------------------------------------------------
# Tickets / inventory
# -----------------------------------------------------------------------------
@app.route("/events/<int:event_id>/tickets", methods=["GET"])
def list_tickets(event_id):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            rows = cur.execute(
                """
                SELECT
                  t.row_name,
                  t.seat_number,
                  t.status,
                  COALESCE(p.base_price, 0) AS base_price
                FROM Tickets t
                LEFT JOIN PriceCodes p ON t.price_code_id = p.price_code_id
                WHERE t.event_id = ?
                ORDER BY t.row_name, t.seat_number
                """,
                (event_id,),
            ).fetchall()
        return jsonify([dict(r) for r in rows]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/events/<int:event_id>/tickets/reserve", methods=["POST"])
@jwt_required()
def reserve(event_id):
    seats = (request.get_json(silent=True) or {}).get("seats") or []
    if not seats:
        return jsonify({"error": "No seats provided"}), 400

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("BEGIN IMMEDIATE")

            failed = []
            for s in seats:
                row, seat = s["row"], int(s["seat"])
                current = cur.execute(
                    """
                    SELECT status FROM Tickets
                     WHERE event_id=? AND row_name=? AND seat_number=?
                    """,
                    (event_id, row, seat),
                ).fetchone()
                if not current or current["status"] != "AVAILABLE":
                    failed.append(f"{row}{seat}")
                    continue

                cur.execute(
                    """
                    UPDATE Tickets
                       SET status='RESERVED'
                     WHERE event_id=? AND row_name=? AND seat_number=? AND status='AVAILABLE'
                    """,
                    (event_id, row, seat),
                )

            if failed:
                conn.rollback()
                return jsonify({"error": "Some seats unavailable", "seats": failed}), 409

            conn.commit()
        return jsonify({"message": "Reserved"}), 200
    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        return jsonify({"error": str(e)}), 500


@app.route("/events/<int:event_id>/tickets/unreserve", methods=["POST"])
@jwt_required()
def unreserve(event_id):
    seats = (request.get_json(silent=True) or {}).get("seats") or []
    if not seats:
        return jsonify({"error": "No seats provided"}), 400

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("BEGIN IMMEDIATE")

            for s in seats:
                row, seat = s["row"], int(s["seat"])
                cur.execute(
                    """
                    UPDATE Tickets
                       SET status='AVAILABLE'
                     WHERE event_id=? AND row_name=? AND seat_number=? AND status='RESERVED'
                    """,
                    (event_id, row, seat),
                )

            conn.commit()
        return jsonify({"message": "Unreserved"}), 200
    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        return jsonify({"error": str(e)}), 500


@app.route("/events/<int:event_id>/tickets/purchase", methods=["POST"])
@jwt_required()
def purchase(event_id):
    user_id = int(get_jwt_identity())
    seats = (request.get_json(silent=True) or {}).get("seats") or []
    if not seats:
        return jsonify({"error": "No seats provided"}), 400

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("BEGIN IMMEDIATE")

            # verify all are RESERVED
            failed = []
            for s in seats:
                row, seat = s["row"], int(s["seat"])
                r = cur.execute(
                    """
                    SELECT status FROM Tickets
                     WHERE event_id=? AND row_name=? AND seat_number=?
                    """,
                    (event_id, row, seat),
                ).fetchone()
                if not r or r["status"] != "RESERVED":
                    failed.append(f"{row}{seat}")

            if failed:
                conn.rollback()
                return jsonify({"error": "Seats not purchasable", "seats": failed}), 409

            now_iso = iso(utc_now())
            for s in seats:
                row, seat = s["row"], int(s["seat"])
                barcode = f"{event_id}-{row}{seat}-{int(utc_now().timestamp())}"

                cur.execute(
                    """
                    UPDATE Tickets
                       SET status='SOLD'
                     WHERE event_id=? AND row_name=? AND seat_number=? AND status='RESERVED'
                    """,
                    (event_id, row, seat),
                )

                cur.execute(
                    """
                    INSERT INTO TicketOwnership (event_id, row_name, seat_number, user_id, barcode, ownership_timestamp)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (event_id, row, seat, user_id, barcode, now_iso),
                )

            conn.commit()
        return jsonify({"message": "Purchased", "count": len(seats)}), 200
    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        return jsonify({"error": str(e)}), 500

# -----------------------------------------------------------------------------
# Stripe: create intent + complete
# -----------------------------------------------------------------------------
@app.route("/events/<int:event_id>/payments/create-intent", methods=["POST"])
@jwt_required()
def create_payment_intent(event_id):
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    seats = data.get("seats") or []

    if not seats:
        return jsonify({"error": "No seats provided"}), 400

    try:
        amount_cents, norm_seats = compute_amount_cents(event_id, seats)

        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            metadata={
                "event_id": str(event_id),
                "user_id": str(user_id),
                "seats": json.dumps(norm_seats),
            },
            # automatic_payment_methods={"enabled": True},  # optional
        )

        return jsonify(
            {
                "clientSecret": intent["client_secret"],
                "paymentIntentId": intent["id"],
                "amount_cents": amount_cents,
            }
        ), 200

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/events/<int:event_id>/payments/complete", methods=["POST"])
@jwt_required()
def complete_payment_and_purchase(event_id):
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    seats = data.get("seats") or []
    payment_intent_id = data.get("payment_intent_id")

    if not seats or not payment_intent_id:
        return jsonify({"error": "Missing seats or payment_intent_id"}), 400

    try:
        pi = stripe.PaymentIntent.retrieve(payment_intent_id)
        if pi["status"] != "succeeded":
            return jsonify({"error": "Payment not successful"}), 400

        amount_cents, norm_seats = compute_amount_cents(event_id, seats)
        if int(pi["amount"]) != int(amount_cents):
            return jsonify({"error": "Payment amount mismatch"}), 400

        # Fulfill
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("BEGIN IMMEDIATE")

            for s in norm_seats:
                row, seat = s["row"], s["seat"]

                cur.execute(
                    """
                    UPDATE Tickets SET status='SOLD'
                     WHERE event_id=? AND row_name=? AND seat_number=?
                    """,
                    (event_id, row, seat),
                )

                cur.execute(
                    """
                    INSERT INTO TicketOwnership (event_id, row_name, seat_number, user_id, barcode, ownership_timestamp)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        event_id,
                        row,
                        seat,
                        user_id,
                        f"{event_id}-{row}{seat}-{int(utc_now().timestamp())}",
                        iso(utc_now()),
                    ),
                )

            conn.commit()

        return jsonify({"message": "Purchase completed", "count": len(norm_seats)}), 200

    except ValueError as ve:
        try:
            conn.rollback()
        except:
            pass
        return jsonify({"error": str(ve)}), 409
    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        return jsonify({"error": str(e)}), 500

# -----------------------------------------------------------------------------
# Run
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    print(app.url_map)
    app.run(debug=True)
