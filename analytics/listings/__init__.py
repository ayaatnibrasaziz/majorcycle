"""Listings "menu" — the searchable directory of US/AU/CA common stocks.

This package builds the `listings` table that backs the "Request a Ticker" search.
It is a SYMBOL DIRECTORY only: it fetches free public exchange symbol files and
normalises them to yfinance format. It never fetches price or fundamental data, so
it is NOT a DataProvider and never imports yfinance — CLAUDE.md #9 stays intact.
The actual data fetch for a requested ticker happens later, in the cron drain,
through the sacred DataProvider interface.
"""
