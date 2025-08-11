import os, sys, sqlite3, string, random

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../database/tessera.db"))

def generate_tickets(event_id: int, num_rows: int, seats_per_row: int, row_to_price_code=None):
    """
    Idempotent: skips seats that already exist.
    row_to_price_code: optional dict like {"A":2,"B":2,"C":1,...} for tiered pricing
    """
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    rows = list(string.ascii_uppercase[:num_rows])  # A, B, C...
    inserted = 0

    for r in rows:
        pcode = (row_to_price_code or {}).get(r, 1)
        for seat in range(1, seats_per_row + 1):
            cur.execute("""
                SELECT 1 FROM Tickets
                WHERE event_id=? AND row_name=? AND seat_number=?
            """, (event_id, r, seat))
            if cur.fetchone():
                continue
            cur.execute("""
                INSERT INTO Tickets (event_id, row_name, seat_number, status, price_code_id)
                VALUES (?, ?, ?, 'AVAILABLE', ?)
            """, (event_id, r, seat, pcode))
            inserted += 1

    conn.commit()
    conn.close()
    print(f"✅ Created {inserted} tickets for event {event_id} "
          f"({num_rows} rows × {seats_per_row} seats).")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python ticket_gen.py <event_id> <num_rows> <seats_per_row> [premium_rows like A,B]")
        sys.exit(1)

    event_id = int(sys.argv[1])
    num_rows = int(sys.argv[2])
    seats_per_row = int(sys.argv[3])

    row_to_price = {}
    if len(sys.argv) >= 5 and sys.argv[4]:
        for r in sys.argv[4].split(","):
            r = r.strip().upper()
            if r:
                row_to_price[r] = 2  # premium price code

    generate_tickets(event_id, num_rows, seats_per_row, row_to_price)
