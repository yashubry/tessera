import sqlite3

def generate_tickets(event_id, num_rows, seats_per_row, price_code_id):
    conn = sqlite3.connect('tessera.db')  # Adjust path if needed
    cursor = conn.cursor()

    for row_index in range(num_rows):
        row_name = chr(65 + row_index)  # A, B, C, etc.
        for seat_number in range(1, seats_per_row + 1):
            cursor.execute('''
                INSERT INTO Tickets (event_id, row_name, seat_number, status, price_code_id)
                VALUES (?, ?, ?, 'AVAILABLE', ?)
            ''', (event_id, row_name, seat_number, price_code_id))

    conn.commit()
    conn.close()
    print(f"Created tickets for event {event_id} ({num_rows} rows x {seats_per_row} seats).")