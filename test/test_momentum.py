# test/test_momentum.py

"""
Tests for logic/momentum.py

These tests are intentionally simple and aligned with FriendlyTicker's
MVP vision: we only care that obvious trends get sensible labels
("Uptrend", "Sideways", "Downtrend") and that momentum shifts big
enough for an alert are detected.

Assumptions about logic/momentum.py:
- calculate_momentum(price_history) accepts a list of numeric prices
  (most recent window), e.g. [10.0, 10.5, 11.0, ...]
- It returns a dict like:
    {
        "label": "Uptrend" | "Sideways" | "Downtrend",
        "score": int  # 0–100
    }
- detect_momentum_shift(old_score, new_score) returns a bool indicating
  whether the change is big enough to trigger an alert.
"""

from logic.momentum import calculate_momentum, detect_momentum_shift


# --------- calculate_momentum tests ---------


def test_calculate_momentum_uptrend():
    """
    Strongly rising prices should be classified as 'Uptrend'
    with a reasonably high score.
    """
    price_history = [10, 11, 12, 13, 14, 15]  # clear upward move
    result = calculate_momentum(price_history)

    assert isinstance(result, dict)
    assert result["label"] == "Uptrend"
    assert isinstance(result["score"], (int, float))
    assert 0 <= result["score"] <= 100
    # For a clear uptrend, score should be in the upper half.
    assert result["score"] >= 60


def test_calculate_momentum_downtrend():
    """
    Strongly falling prices should be classified as 'Downtrend'
    with a reasonably high score.
    """
    price_history = [15, 14, 13, 12, 11, 10]  # clear downward move
    result = calculate_momentum(price_history)

    assert isinstance(result, dict)
    assert result["label"] == "Downtrend"
    assert isinstance(result["score"], (int, float))
    assert 0 <= result["score"] <= 100
    # For a clear downtrend, score should be in the upper half.
    assert result["score"] >= 60


def test_calculate_momentum_sideways():
    """
    Mostly flat prices with small noise should be 'Sideways'
    with a moderate score (not strongly trending).
    """
    price_history = [10, 10.1, 9.9, 10.05, 9.95, 10.0]  # choppy but flat
    result = calculate_momentum(price_history)

    assert isinstance(result, dict)
    assert result["label"] == "Sideways"
    assert isinstance(result["score"], (int, float))
    assert 0 <= result["score"] <= 100
    # For sideways, score should not be extreme
    assert 20 <= result["score"] <= 80


def test_calculate_momentum_score_bounds():
    """
    Sanity check: regardless of the data, score should always stay between 0 and 100.
    """
    very_choppy = [10, 20, 5, 25, 3, 30]
    result = calculate_momentum(very_choppy)
    assert 0 <= result["score"] <= 100


# --------- detect_momentum_shift tests ---------


def test_detect_momentum_shift_no_significant_change():
    """
    Small changes in score should NOT trigger a momentum shift alert.
    """
    old_score = 50
    new_score = 54  # small change
    has_shift = detect_momentum_shift(old_score, new_score)
    assert has_shift is False


def test_detect_momentum_shift_significant_upward_change():
    """
    A big jump upward in score should trigger a momentum shift alert.
    """
    old_score = 40
    new_score = 80  # large upward change
    has_shift = detect_momentum_shift(old_score, new_score)
    assert has_shift is True


def test_detect_momentum_shift_significant_downward_change():
    """
    A big drop in score should also trigger a momentum shift alert.
    """
    old_score = 80
    new_score = 40  # large downward change
    has_shift = detect_momentum_shift(old_score, new_score)
    assert has_shift is True
