PRESETS: dict[str, dict[str, float | int]] = {
    "short":  {"pullback_threshold": -3.0, "profit_threshold": 3.0,  "lookback_bars": 63},
    "medium": {"pullback_threshold": -5.0, "profit_threshold": 5.0,  "lookback_bars": 252},
    "long":   {"pullback_threshold": -8.0, "profit_threshold": 8.0,  "lookback_bars": 756},
}
