# auth/session.py

"""
MVP session/auth helper for FriendlyTicker.

The real product will eventually have:
- User accounts
- Login
- Tokens / sessions
- Premium status checks
- Per-user stored watchlists in a database

But for the MVP (as described in the vision + technical plan),
we do NOT build real authentication yet.

We simply return a fixed demo user so the watchlist +
analysis system works end-to-end.

The backend treats all requests as coming from this
single user until real auth is implemented.
"""


def get_current_user() -> str:
    """
    Return a placeholder user ID for the MVP.

    Later: replace with real authentication logic
    (JWT tokens, session cookies, OAuth, Magic links, etc.)

    For now, the entire app shares a single logical user:
        "demo-user-1"

    This keeps the architecture correct while letting you
    build, test, and demo the app without auth complexity.
    """
    return "demo-user-1"
