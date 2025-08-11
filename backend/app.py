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


if __name__ == '__main__':
    print(app.url_map)
    app.run(debug=True)