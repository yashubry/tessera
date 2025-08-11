from flask import Flask, jsonify, request
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
#import bcrypt #apparently this is important for password hashing 
from geopy.geocoders import Nominatim
from datetime import datetime, timedelta
import requests
import os 
from flask_cors import CORS


from flask_jwt_extended import create_access_token
from flask_jwt_extended import get_jwt_identity
from flask_jwt_extended import jwt_required
from flask_jwt_extended import JWTManager


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, allow_headers=["Content-Type", "Authorization"])

# Setup the Flask-JWT-Extended extension
app.config["JWT_SECRET_KEY"] = "imsohungryhelp"  # Change this!
jwt = JWTManager(app)


def get_db_connection():
    db_path = os.path.abspath('../database/tessera.db')
    print(f"Using database at: {db_path}")
    conn = sqlite3.connect(db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


@app.route('/events', methods=['GET'])
def get_events():
    query = 'SELECT * FROM Events'
    params = []

    after_date = request.args.get('afterDate')
    location = request.args.get('location')

    if after_date and location:
        query += ' WHERE date > ? AND location = ?'
        params.extend([after_date, location])
    elif after_date:
        query += ' WHERE date > ?'
        params.append(after_date)
    elif location:
        query += ' WHERE location = ?'
        params.append(location)

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            events = cursor.fetchall()
            events_list = [dict(event) for event in events]
        return jsonify(events_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    


@app.route('/user', methods=['POST'])
def create_user():
    email = request.json.get('email')
    username = request.json.get('username')
    password = request.json.get('password')
    

    if not email or not username or not password:
        return jsonify({'error': 'All fields (email, username, and password) are required.'}), 400

    hashed_password = generate_password_hash(password)
    created_at = datetime.now().isoformat()

    user_ip = request.remote_addr
    #location = get_location(user_ip)


    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('INSERT INTO Users (email, username, password_hash) VALUES (?, ?, ?)',
                (email, username, hashed_password)
            )
            conn.commit()

            cursor.execute('SELECT user_id FROM Users WHERE username = ?', (username,))
            new_user_id = cursor.fetchone()

        return jsonify({'message': 'User created successfully', 
                        'user_id': new_user_id['user_id'],
                        'created_time': created_at
                        }), 201

    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username or email already exists.'}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'All fields are required.'}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Now selecting user_id too
            cursor.execute('SELECT user_id, username, password_hash FROM Users WHERE username = ?', (username,))
            row = cursor.fetchone()

            if row is None:
                return jsonify({'error': 'Invalid username or password.'}), 401

            if check_password_hash(row['password_hash'], password):
                # ✅ Set the identity to be the user's ID
                access_token = create_access_token(
                    identity=str(row['user_id']),
                    expires_delta=timedelta(hours=1)
                )

                return jsonify({
                    'message': 'Login successful hooray!',
                    'access_token': access_token
                }), 200
            else:
                return jsonify({'error': 'Invalid username or password.'}), 401

    except Exception as e:
        return jsonify({'error': str(e)}), 500


    

# CHANGE USERNAME/PASSWORD ENDPOINT 
 #MADE THIS A JWT PROTECTED ROUTE 
@app.route('/user/password', methods=['PUT']) #created endpoint, PUT because we are changing it !
@jwt_required()
def change_password() :

    current_identity = get_jwt_identity()
    if current_identity:
        #first ask for the regular username and password 
        username = current_identity['username']
        password = request.json.get('password')

        new_password = request.json.get('new_password') #then ask for the new password 

        if not username or not password or not new_password: 
            return jsonify({'error': 'All feilds are required.'}), 400
        
        try:
            with get_db_connection() as conn: # we need to connect to the server here 
                cursor = conn.cursor() 
                cursor.execute('SELECT password_hash FROM Users WHERE username = ?', (username,))
                row = cursor.fetchone()

                if row is None:  # if nothing in inputted or if it is invalid 
                    return jsonify({'error': 'Invalid username or password.'}), 401

                password_hash = row['password_hash']

                if not check_password_hash(password_hash, password):
                    return jsonify({'error': 'Incorrect current password.'}), 401
                
                
                new_password_hash = generate_password_hash(new_password) 

                # extra: want to make it so that if the new password matched the old password, we get an error message 
                if check_password_hash(password_hash, new_password):
                    return jsonify({'error': 'your new password cannot be the same as the current password.'}), 400
                
                new_hashed = generate_password_hash(new_password)

                cursor.execute('UPDATE Users SET password_hash = ? WHERE username = ?', (new_password_hash, username))

                conn.commit()

            return jsonify({'message': 'Password updated successfully.'}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        
@app.route('/user/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    username = data.get('username')
    email = data.get('email')
    phone = data.get('phone')
    profile_pic_url = data.get('profile_pic_url')

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            '''
            UPDATE Users
            SET username = COALESCE(?, username),
                email = COALESCE(?, email)
            WHERE user_id = ?
            ''',
            (username, email, user_id)
        )
        conn.commit()
        conn.close()

        return jsonify({"msg": "Profile updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500



    
@app.route('/user/profile', methods=['GET'])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    conn = get_db_connection()
    user = conn.execute('SELECT username, email FROM Users WHERE user_id = ?', (user_id,)).fetchone()
    conn.close()

    if user is None:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "username": user["username"],
        "email": user["email"]
    })

# inventory info PUBLIC 
@app.route('/events/<int:event_id>/tickets', methods=['GET'])
def list_tickets(event_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # treat expired reservations as available on read
        now_iso = iso(utc_now())
        cur.execute("""
          SELECT
            t.row_name,
            t.seat_number,
            CASE
              WHEN t.status='RESERVED' AND (t.reserved_until IS NULL OR t.reserved_until < ?) THEN 'AVAILABLE'
              ELSE t.status
            END AS status,
            p.base_price
          FROM Tickets t
          JOIN PriceCodes p ON t.price_code_id = p.price_code_id
          WHERE t.event_id = ?
          ORDER BY t.row_name, t.seat_number
        """, (now_iso, event_id))

        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return jsonify(rows), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

#reserve seets 
RESERVE_MINUTES = 10

@app.route('/events/<int:event_id>/tickets/reserve', methods=['POST'])
@jwt_required()
def reserve(event_id):
    user_id = int(get_jwt_identity())
    seats = request.json.get('seats') or []  # [{row:"A", seat:5}, ...]

    if not seats:
        return jsonify({"error": "No seats provided"}), 400

    expires_at = iso(utc_now() + timedelta(minutes=RESERVE_MINUTES))
    now_iso = iso(utc_now())

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # START a write transaction to avoid races
        cur.execute("BEGIN IMMEDIATE")

        # Check + update each seat only if it's currently available or the reservation is expired
        failed = []
        for s in seats:
            row, seat = s['row'], int(s['seat'])

            # Verify seat is not SOLD and is AVAILABLE or RESERVED but expired
            cur.execute("""
              SELECT status, reserved_until, reserved_by_user_id
              FROM Tickets
              WHERE event_id=? AND row_name=? AND seat_number=? 
            """, (event_id, row, seat))
            rec = cur.fetchone()
            if not rec or rec['status'] == 'SOLD':
                failed.append(f"{row}{seat}")
                continue

            is_expired = (rec['status'] == 'RESERVED' and (rec['reserved_until'] is None or rec['reserved_until'] < now_iso))
            can_take = rec['status'] == 'AVAILABLE' or is_expired or rec['reserved_by_user_id'] == user_id

            if not can_take:
                failed.append(f"{row}{seat}")
                continue

            cur.execute("""
              UPDATE Tickets
              SET status='RESERVED',
                  reserved_by_user_id=?,
                  reserved_until=?
              WHERE event_id=? AND row_name=? AND seat_number=? 
            """, (user_id, expires_at, event_id, row, seat))

        if failed:
            conn.rollback()
            return jsonify({"error": "Some seats unavailable", "seats": failed}), 409

        conn.commit()
        return jsonify({"message": "Reserved", "expires_at": expires_at}), 200

    except Exception as e:
        try: conn.rollback()
        except: pass
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

#unreserve seats 
@app.route('/events/<int:event_id>/tickets/unreserve', methods=['POST'])
@jwt_required()
def unreserve(event_id):
    user_id = int(get_jwt_identity())
    seats = request.json.get('seats') or []

    if not seats:
        return jsonify({"error": "No seats provided"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("BEGIN IMMEDIATE")

        for s in seats:
            row, seat = s['row'], int(s['seat'])
            # Only the user who reserved it can unreserve
            cur.execute("""
              UPDATE Tickets
              SET status='AVAILABLE', reserved_by_user_id=NULL, reserved_until=NULL
              WHERE event_id=? AND row_name=? AND seat_number=? AND status='RESERVED' AND reserved_by_user_id=?
            """, (event_id, row, seat, user_id))

        conn.commit()
        return jsonify({"message": "Unreserved"}), 200

    except Exception as e:
        try: conn.rollback()
        except: pass
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

#purchase seats 
def gen_barcode(event_id, row, seat):
    return f"{event_id}-{row}{seat}-{int(utc_now().timestamp())}"

@app.route('/events/<int:event_id>/tickets/purchase', methods=['POST'])
@jwt_required()
def purchase(event_id):
    user_id = int(get_jwt_identity())
    seats = request.json.get('seats') or []  # [{row:"A", seat:5}, ...]

    if not seats:
        return jsonify({"error": "No seats provided"}), 400

    now_iso = iso(utc_now())

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("BEGIN IMMEDIATE")

        # 1) verify all seats are reserved by this user (or expired -> not allowed)
        failed = []
        for s in seats:
            row, seat = s['row'], int(s['seat'])
            cur.execute("""
              SELECT status, reserved_by_user_id, reserved_until
              FROM Tickets
              WHERE event_id=? AND row_name=? AND seat_number=?
            """, (event_id, row, seat))
            rec = cur.fetchone()
            if not rec or rec['status'] == 'SOLD':
                failed.append(f"{row}{seat}")
                continue
            if rec['status'] != 'RESERVED' or rec['reserved_by_user_id'] != user_id or (rec['reserved_until'] and rec['reserved_until'] < now_iso):
                failed.append(f"{row}{seat}")

        if failed:
            conn.rollback()
            return jsonify({"error": "Seats not purchasable", "seats": failed}), 409

        # 2) mark SOLD + write ownership
        for s in seats:
            row, seat = s['row'], int(s['seat'])
            barcode = gen_barcode(event_id, row, seat)

            cur.execute("""
              UPDATE Tickets
              SET status='SOLD', reserved_by_user_id=NULL, reserved_until=NULL
              WHERE event_id=? AND row_name=? AND seat_number=?
            """, (event_id, row, seat))

            cur.execute("""
              INSERT INTO TicketOwnership (event_id, row_name, seat_number, user_id, barcode, ownership_timestamp)
              VALUES (?, ?, ?, ?, ?, ?)
            """, (event_id, row, seat, user_id, barcode, now_iso))

        conn.commit()
        return jsonify({"message": "Purchased", "count": len(seats)}), 200

    except Exception as e:
        try: conn.rollback()
        except: pass
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


if __name__ == '__main__':
    print(app.url_map)
    app.run(debug=True)