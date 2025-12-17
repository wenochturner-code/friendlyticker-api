# billing/feature_flags.py

"""
Feature flag + premium access helpers for FriendlyTicker.

According to the product vision and MVP plan:

- The MVP does NOT implement real billing yet.
- All users are treated as FREE tier.
- Premium features (larger watchlist limit, advanced AI, history)
  will be added later once Stripe/subscriptions are implemented.

The purpose of this file is to:
1. Keep the codebase architecturally clean.
2. Allow services (like watchlist_service) to check premium
   status without needing billing to be built yet.
3. Provide a single place to upgrade later when premium
   features and billing are added.

During MVP:
    is_premium(user_id) → always returns False
"""


def is_premium(user_id: str) -> bool:
    """
    Return True if the given user is a premium subscriber.

    MVP behavior:
        - Always return False (every user is free tier)
        - No real billing logic exists yet
        - This keeps the app consistent with the vision:
            * small watchlist limit
            * basic AI features only
            * premium features reserved for future versions

    When upgrading later:
        - Integrate Stripe or another billing provider
        - Load subscription level from database
        - Update this function accordingly
    """
    return False
