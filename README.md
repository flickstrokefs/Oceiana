# BabluBlast Authentication Backend

A secure, production-oriented authentication backend built with **FastAPI**, **SQLAlchemy**, **PostgreSQL**, **Alembic**, and **JWT** authentication.

The project provides user registration, login, logout, token refresh, password reset, password change, and protected-user endpoints with security-focused practices such as password hashing, refresh-token storage, rate limiting, input validation, and generic authentication errors.

---

## 🚀 Features

* User registration
* User login
* JWT access-token authentication
* JWT refresh-token authentication
* HTTP-only refresh-token cookies
* User logout
* Protected `/auth/me` endpoint
* Forgot-password flow
* Password reset
* Change password
* Argon2 password hashing
* Password-strength validation
* Email normalization
* Duplicate-email protection
* Authentication rate limiting
* Generic login errors to prevent email enumeration
* Automatic password-hash rehashing
* SQLAlchemy async database support
* PostgreSQL support
* Alembic database migrations
* Automated authentication tests
* SQLite in-memory database for testing
* Environment-based configuration
* CORS configuration

---

## 🛠️ Tech Stack

| Technology     | Purpose                           |
| -------------- | --------------------------------- |
| **FastAPI**    | Web API framework                 |
| **Uvicorn**    | ASGI server                       |
| **SQLAlchemy** | ORM and database access           |
| **Alembic**    | Database migrations               |
| **PostgreSQL** | Production database               |
| **Pydantic**   | Request/response validation       |
| **JWT**        | Access and refresh authentication |
| **Argon2**     | Password hashing                  |
| **SlowAPI**    | Rate limiting                     |
| **Pytest**     | Testing                           |
| **HTTPX**      | Async API testing                 |

---

## 📁 Project Structure

```text
auth-backend-clean/
│
├── alembic/
│   ├── versions/
│   │   └── 0001_initial_auth.py
│   ├── env.py
│   ├── script.py.mako
│   └── README
│
├── app/
│   ├── core/
│   │   ├── config.py
│   │   └── security.py
│   │
│   ├── db/
│   │   └── session.py
│   │
│   ├── middleware/
│   │   └── auth.py
│   │
│   ├── models/
│   │   └── user.py
│   │
│   ├── routers/
│   │   └── auth.py
│   │
│   ├── schemas/
│   │   └── auth.py
│   │
│   └── main.py
│
├── tests/
│   ├── conftest.py
│   └── test_auth.py
│
├── .env.example
├── .gitignore
├── alembic.ini
├── pytest.ini
└── requirements.txt
```

---

# ⚙️ Installation

## 1. Clone the repository

```bash
git clone https://github.com/flickstrokefs/BabluBlast.git
cd BabluBlast
```

Switch to the authentication branch:

```bash
git checkout authentication
```

---

## 2. Create a virtual environment

### Windows

```powershell
python -m venv venv
```

Activate it:

```powershell
venv\Scripts\activate
```

### Linux/macOS

```bash
python3 -m venv venv
source venv/bin/activate
```

---

## 3. Install dependencies

```bash
pip install -r requirements.txt
```

---

# 🔐 Environment Configuration

Create a `.env` file based on `.env.example`.

Example:

```env
DATABASE_URL=postgresql+asyncpg://username:password@host:5432/database

JWT_SECRET=your-secure-access-token-secret
JWT_REFRESH_SECRET=your-secure-refresh-token-secret

ENVIRONMENT=development

CORS_ORIGINS=http://localhost:5173
```

### Important

Never commit your real `.env` file or production secrets to GitHub.

Use `.env.example` to document the required environment variables without exposing credentials.

For production, use strong randomly generated secrets.

---

# 🗄️ Database Setup

The application uses **PostgreSQL** with asynchronous SQLAlchemy.

The database URL is read from the `DATABASE_URL` environment variable.

After configuring the database, run the Alembic migrations:

```bash
alembic upgrade head
```

This creates the authentication tables.

### Current database tables

#### `users`

Stores:

* UUID user ID
* Email
* Argon2 password hash
* Account active status
* Creation timestamp
* Update timestamp
* Password-reset information

#### `refresh_tokens`

Stores:

* UUID token ID
* Associated user ID
* Hashed refresh token
* Expiration timestamp
* Creation timestamp

Refresh tokens are stored as hashes rather than storing the raw token in the database.

---

# ▶️ Running the Application

From the project root:

```bash
uvicorn app.main:app --reload
```

The API will be available at:

```text
http://127.0.0.1:8000
```

Interactive API documentation:

```text
http://127.0.0.1:8000/docs
```

Alternative ReDoc documentation:

```text
http://127.0.0.1:8000/redoc
```

---

# 🔑 Authentication API

All authentication routes use the `/auth` prefix.

## Register

```http
POST /auth/register
```

Example:

```json
{
  "email": "user@example.com",
  "password": "Secure123"
}
```

Password requirements:

* Minimum 8 characters
* Maximum 128 characters
* At least one uppercase letter
* At least one lowercase letter
* At least one number

Successful registration returns safe user information without exposing the password or password hash.

---

## Login

```http
POST /auth/login
```

Example:

```json
{
  "email": "user@example.com",
  "password": "Secure123"
}
```

Returns:

```json
{
  "access_token": "JWT_ACCESS_TOKEN",
  "token_type": "bearer"
}
```

A refresh token is also issued using an **HTTP-only cookie**.

---

## Get Current User

```http
GET /auth/me
```

Requires:

```http
Authorization: Bearer <access_token>
```

Returns the authenticated user's information.

---

## Refresh Access Token

```http
POST /auth/refresh
```

The refresh token is read from the HTTP-only cookie and a new access token is issued.

---

## Logout

```http
POST /auth/logout
```

Invalidates the user's refresh-token session and clears the refresh cookie.

---

## Forgot Password

```http
POST /auth/forgot-password
```

Example:

```json
{
  "email": "user@example.com"
}
```

The backend generates a password-reset token for the account.

Reset tokens are stored securely as hashes rather than raw values.

---

## Reset Password

```http
POST /auth/reset-password
```

Example:

```json
{
  "token": "RESET_TOKEN",
  "new_password": "NewSecure123"
}
```

The new password must satisfy the password-strength requirements.

---

## Change Password

```http
POST /auth/change-password
```

Requires authentication.

Example:

```json
{
  "current_password": "Secure123",
  "new_password": "NewSecure123"
}
```

---

# 🛡️ Security

Security is a major focus of this backend.

### Password hashing

Passwords are never stored as plaintext.

The backend uses **Argon2** to securely hash passwords.

```text
Plain password
      ↓
    Argon2
      ↓
Password hash
      ↓
Database
```

---

### JWT authentication

The backend uses separate access and refresh tokens.

```text
Login
  │
  ├── Access Token
  │      └── Used for API authorization
  │
  └── Refresh Token
         └── Stored in HTTP-only cookie
```

Access tokens are used to access protected routes.

Refresh tokens are used to obtain new access tokens without requiring the user to log in again.

---

### HTTP-only refresh cookies

Refresh tokens are delivered through an HTTP-only cookie.

This prevents JavaScript from directly accessing the refresh token.

The cookie is configured with:

* `HttpOnly`
* `Secure`
* `SameSite=Lax`
* Limited `/auth` path
* Seven-day lifetime

> The `Secure` cookie setting requires HTTPS in production.

---

### Rate limiting

Sensitive authentication endpoints are rate-limited using SlowAPI.

This helps reduce:

* Brute-force login attempts
* Password-reset abuse
* Registration abuse
* Automated attacks

---

### Generic authentication errors

Invalid login attempts return:

```text
Invalid email or password
```

rather than revealing whether:

* The email exists
* The password was incorrect

This helps prevent account/email enumeration.

---

### Password rehashing

If Argon2 parameters are changed in the future, existing passwords can be automatically rehashed after a successful login.

This allows password-security parameters to improve without forcing every user to reset their password.

---

# 🧪 Testing

The project includes an authentication test suite covering:

* Registration
* Duplicate email handling
* Invalid email validation
* Password validation
* Password length limits
* Login
* Incorrect passwords
* Non-existent accounts
* Malformed requests
* Access-token authentication
* Protected routes
* Invalid tokens
* Refresh tokens
* Refresh cookies
* Logout
* Password reset
* Password changes

Run the test suite with:

```bash
pytest
```

The tests use an **in-memory SQLite database**, so they do not modify the production PostgreSQL database.

---

# 🔄 Database Migrations

Create a new migration after changing SQLAlchemy models:

```bash
alembic revision --autogenerate -m "describe your change"
```

Apply migrations:

```bash
alembic upgrade head
```

Rollback the latest migration:

```bash
alembic downgrade -1
```

Check the current migration:

```bash
alembic current
```

View migration history:

```bash
alembic history
```

---

# 🌐 CORS

CORS origins are configured through the environment.

Example:

```env
CORS_ORIGINS=http://localhost:5173
```

For production, configure this with the actual frontend domain instead of allowing unrestricted origins.

---

# 📌 Development Workflow

Start the backend:

```bash
uvicorn app.main:app --reload
```

Run tests:

```bash
pytest
```

Create migrations when models change:

```bash
alembic revision --autogenerate -m "update database schema"
```

Apply migrations:

```bash
alembic upgrade head
```

---

# 🚧 Production Considerations

Before deploying to production:

* Use HTTPS
* Generate strong JWT secrets
* Keep `.env` out of version control
* Use a managed PostgreSQL database
* Configure production CORS origins
* Review cookie configuration for the frontend deployment
* Configure proper logging and monitoring
* Keep dependencies updated
* Run the complete test suite before deployment
* Never expose password hashes or authentication secrets
* Use appropriate database backups

---

# 📄 License

This project is currently maintained as part of the **BabluBlast** project.

---

## 👨‍💻 Project

**Repository:** [BabluBlast](https://github.com/flickstrokefs/BabluBlast)

**Authentication Branch:** `authentication`

**Backend:** FastAPI

**Database:** PostgreSQL

**Authentication:** JWT + HTTP-only refresh cookies

**Password Hashing:** Argon2
