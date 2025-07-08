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
CORS(app)

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
    

    #first we have to make sure all the feilds have been entered in 
    if not username or not password: 
        return jsonify({'error': 'All feilds are required.'}), 400
    #next, we need to check if the login is correct, then send a json message, 200

    #conn = get_db_connection()
    #cursor = conn.cursor()  ADD THIS WITHIN THE TRY BLOCK 

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT username, password_hash FROM Users WHERE username = ?', (username,))
            row = cursor.fetchone()

            if row is None:  # if nothing in inputted or if it is invalid 
                return jsonify({'error': 'Invalid username or password.'}), 401

            password_hash = row['password_hash']

            if check_password_hash(password_hash, password):
                payload = {   #payload for the JWT access token 
                    'username': row['username'],
                }
                access_token = create_access_token(identity=payload, expires_delta=timedelta(hours=1))  #this is the access token with 1 hour expiration
                return jsonify({'message': 'Login successful hooray!', 'access_token': access_token}), 200 #THIS IS JSON FORMAT FOR A REASON?
            else:
                return jsonify({'error': 'Invalid username or password.'}), 401

    except Exception as e:
        return jsonify({'error': str(e)}), 500

    

# CHANGE USERNAME/PASSWORD ENDPOINT 
@jwt_required() #MADE THIS A JWT PROTECTED ROUTE 
@app.route('/user/password', methods=['PUT']) #created endpoint, PUT because we are changing it !
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
        
#EDIT USER PROFILE API ENDPOINT 
@jwt_required()  #this is a protected route 
def update_profile() : 
    identity = get_jwt_identity()
    user_id = identity['user_id']
    
    data = request.get_json()
    new_email = data.get('email')
    new_username = data.get('username')
    #new_location = data.get('location')

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                '''
                UPDATE Users SET email = ?, username = ?
                WHERE user_id = ?
                ''',
                (new_email, new_username, user_id)
            )
            conn.commit()
        return jsonify({'message': 'Profile updated successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    

if __name__ == '__main__':
    print(app.url_map)
    app.run(debug=True)