"""Flighthelper — Google Flights-style multi-destination search.

Run: streamlit run app.py
"""

from __future__ import annotations

import os
import time
from pathlib import Path

import streamlit as st
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env", override=True)

from lib import deeplink, images, parser, search  # noqa: E402

st.set_page_config(
    page_title="Flighthelper",
    page_icon="✈️",
    layout="wide",
    initial_sidebar_state="expanded",
)


# ---------- styling ------------------------------------------------------

CUSTOM_CSS = """
<style>
.main .block-container { padding-top: 2rem; max-width: 1300px; }
h1, h2, h3 { font-weight: 600; }
.origin-label { text-align: center; color: #aaa; font-size: 0.95rem; margin-bottom: 0.5rem; }
.origin-label b { color: #fafafa; }
.card {
    background: #1a1a1a; border-radius: 14px; overflow: hidden;
    margin-bottom: 1rem; transition: transform 0.15s ease; border: 1px solid #2a2a2a;
}
.card:hover { transform: translateY(-3px); border-color: #4a9eff; }
.card-img-wrap { position: relative; height: 220px; overflow: hidden; }
.card-img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
.card-img-overlay {
    position: absolute; bottom: 0; left: 0; right: 0; padding: 1rem;
    background: linear-gradient(0deg, rgba(0,0,0,0.85), rgba(0,0,0,0));
}
.card-title { font-size: 1.4rem; font-weight: 600; color: white; line-height: 1.1; }
.card-country { font-size: 0.95rem; color: #ccc; font-weight: 400; margin-left: 0.4rem; }
.card-body { padding: 1rem; display: flex; justify-content: space-between; align-items: flex-end; }
.card-meta { font-size: 0.85rem; color: #bbb; line-height: 1.5; }
.card-meta b { color: #fafafa; }
.card-price { font-size: 1.7rem; font-weight: 600; color: #fafafa; white-space: nowrap; }
.card-source { font-size: 0.7rem; color: #666; margin-top: 0.3rem; }
.stale-banner {
    background: #3a2a1a; color: #ffaa66; padding: 0.5rem 0.8rem;
    border-radius: 8px; font-size: 0.85rem; margin: 0.5rem 0;
}
a.book-link { text-decoration: none; color: inherit; display: block; }
a.book-link:hover { color: inherit; }
.placeholder-img {
    width: 100%; height: 220px;
    background: linear-gradient(135deg, #1f3a5f, #0f1a2f);
    display: flex; align-items: center; justify-content: center;
    color: #4a9eff; font-size: 3rem;
}
.flex-badge {
    display: inline-block; background: #2a4a6a; color: #aaccff;
    font-size: 0.7rem; padding: 0.1rem 0.5rem; border-radius: 10px;
    margin-left: 0.4rem; font-weight: 500;
}
</style>
"""

st.markdown(CUSTOM_CSS, unsafe_allow_html=True)


# ---------- session state -----------------------------------------------

DEFAULTS = {
    "origin": "Karachi",
    "max_stops": "Any",
    "max_price": 0.0,         # 0 = no cap
    "cabin_override": "From query",
    "exclude_airlines": "",
    "max_duration_hours": 0,  # 0 = no cap
}
for k, v in DEFAULTS.items():
    st.session_state.setdefault(k, v)


# ---------- header -------------------------------------------------------

st.markdown(
    f"<div class='origin-label'>from <b>{st.session_state.origin}</b> "
    f"<small style='color:#666'>(change in sidebar)</small></div>",
    unsafe_allow_html=True,
)

cols = st.columns([1, 6, 1])
with cols[1]:
    query = st.text_input(
        "Search",
        placeholder="cheapest flights to malaysia return in july for 2 weeks",
        label_visibility="collapsed",
        key="search_query",
    )
    search_clicked = st.button("Search flights", type="primary", use_container_width=True)


# ---------- sidebar: settings + filters ---------------------------------

with st.sidebar:
    st.header("⚙️ Settings")
    new_origin = st.text_input(
        "Default origin",
        value=st.session_state.origin,
        help="Used when your query doesn't say 'from X'. Country, city, or IATA.",
    )
    if new_origin != st.session_state.origin:
        st.session_state.origin = new_origin
        st.rerun()

    st.divider()
    st.header("🎚️ Filters")
    st.caption("Applied after results return. Cheapest still wins by default.")

    st.session_state.max_stops = st.selectbox(
        "Max stops",
        ["Any", "Nonstop only", "≤1 stop", "≤2 stops"],
        index=["Any", "Nonstop only", "≤1 stop", "≤2 stops"].index(st.session_state.max_stops),
    )
    st.session_state.cabin_override = st.selectbox(
        "Cabin",
        ["From query", "economy", "premium-economy", "business", "first"],
        index=["From query", "economy", "premium-economy", "business", "first"].index(
            st.session_state.cabin_override
        ),
    )
    st.session_state.max_price = st.number_input(
        "Max price (any currency, 0 = no cap)",
        min_value=0.0,
        value=float(st.session_state.max_price),
        step=100.0,
        help="In whatever currency Google shows you (PKR if searching from Karachi).",
    )
    st.session_state.max_duration_hours = st.number_input(
        "Max duration hours (0 = no cap)",
        min_value=0,
        value=int(st.session_state.max_duration_hours),
        step=2,
    )
    st.session_state.exclude_airlines = st.text_input(
        "Exclude airlines (comma-sep)",
        value=st.session_state.exclude_airlines,
        placeholder="e.g. Spirit, Frontier",
    )

    st.divider()
    st.caption(
        "Data: Google Flights (via fast-flights protobuf URL trick) with "
        "Amadeus Self-Service free tier as fallback. Clicking a card opens "
        "Google Flights pre-filled — book there for the live price."
    )


def build_filters_from_ui() -> search.Filters:
    stops_map = {"Any": None, "Nonstop only": 0, "≤1 stop": 1, "≤2 stops": 2}
    excluded = [s.strip() for s in st.session_state.exclude_airlines.split(",") if s.strip()]
    return search.Filters(
        max_stops=stops_map[st.session_state.max_stops],
        max_price=float(st.session_state.max_price) if st.session_state.max_price > 0 else None,
        max_duration_hours=float(st.session_state.max_duration_hours) if st.session_state.max_duration_hours > 0 else None,
        exclude_airlines=excluded,
    )


# ---------- search execution --------------------------------------------

def run_search(raw_query: str) -> None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        st.error(
            "ANTHROPIC_API_KEY is missing. Copy `.env.example` to `.env` and add your key."
        )
        return

    with st.status("Understanding your query…", expanded=False) as status:
        try:
            parsed = parser.parse_query(raw_query, default_origin=st.session_state.origin)
        except Exception as e:
            status.update(label="Couldn't parse query", state="error")
            st.error(f"Parser failed: {e}")
            return

        # Cabin override from sidebar takes precedence.
        if st.session_state.cabin_override != "From query":
            parsed = {**parsed, "cabin": st.session_state.cabin_override}

        origin_iata = search.resolve_origin(parsed["origin"])
        if not origin_iata:
            status.update(label="Unknown origin", state="error")
            st.error(
                f"Don't know where '{parsed['origin']}' is. Add it to "
                f"`lib/destinations.py` or pick a known city in the sidebar."
            )
            return

        depart_dates = parsed["depart_dates"]
        return_dates = parsed.get("return_dates")
        flex = len(depart_dates) > 1
        date_summary = (
            f"flex across {len(depart_dates)} date pairs" if flex
            else (f"{depart_dates[0]} → {return_dates[0]}" if return_dates else f"{depart_dates[0]} (one-way)")
        )
        status.update(
            label=(
                f"Searching {origin_iata} → {', '.join(parsed['destinations'])} "
                f"· {date_summary}"
            ),
            state="running",
        )

        filters = build_filters_from_ui()
        t0 = time.time()
        cards, stats = search.search(
            origin_iata=origin_iata,
            destination_names=parsed["destinations"],
            depart_dates=depart_dates,
            return_dates=return_dates,
            cabin=parsed.get("cabin", "economy"),
            pax=int(parsed.get("pax", 1)),
            filters=filters,
        )
        elapsed = time.time() - t0
        status.update(
            label=(
                f"Found {len(cards)} destinations · "
                f"{stats.total_succeeded}/{stats.total_attempts} searches "
                f"returned data · {elapsed:.1f}s"
            ),
            state="complete",
        )

    if not cards:
        st.warning(
            "No results matched. Try relaxing filters, picking different dates, "
            "or confirming your destination is in `lib/destinations.py`."
        )
        return

    # Evidence row — show user we actually checked the space.
    if flex:
        st.markdown(
            f"### ✓ {len(cards)} deals from {parsed['origin']} "
            f"<span style='color:#888;font-weight:normal;font-size:0.7em'>"
            f"· best of {stats.date_combos} date combinations</span>",
            unsafe_allow_html=True,
        )
    else:
        st.markdown(f"### ✓ {len(cards)} deals from {parsed['origin']}")

    # Per-destination evidence: how many combos, price spread.
    if flex and any(c.combos_tried > 1 for c in cards):
        evidence_lines = []
        for c in cards:
            if c.combos_succeeded >= 2 and c.price_max > c.price_min:
                pct = (c.price_max - c.price_min) / c.price_min * 100
                evidence_lines.append(
                    f"**{c.dest_label}**: checked {c.combos_succeeded} options "
                    f"({c.combos_tried - c.combos_succeeded} timed out) · "
                    f"prices ranged from `{c.price_min:,.0f}` to `{c.price_max:,.0f}` {c.currency} "
                    f"(spread {pct:.0f}%) · we picked the cheapest"
                )
        if evidence_lines:
            with st.expander("📊 How we know it's the cheapest", expanded=False):
                for line in evidence_lines:
                    st.markdown(line)
                st.caption(
                    "Each card's best price is the lowest across all date pairs × airports we successfully queried. "
                    "Timed-out queries are retried; persistent failures are reported above. "
                    "If you want every single day tested, type a specific date range like 'July 8 to July 22'."
                )

    st.caption("Click any card to open the search on Google Flights and book.")

    render_cards(cards, parsed)


# ---------- rendering ---------------------------------------------------

def render_cards(cards, parsed) -> None:
    for i in range(0, len(cards), 2):
        row = cards[i : i + 2]
        cols = st.columns(2)
        for col, card in zip(cols, row):
            with col:
                render_card(card, parsed)


def render_card(card, parsed) -> None:
    img_url = images.hero_image(card.wiki_title)
    book_url = deeplink.booking_url(
        origin=card.best.origin,
        dest=card.best.dest_iata,
        depart=card.best.depart_date,
        ret=card.best.return_date,
        pax=int(parsed.get("pax", 1)),
        cabin=parsed.get("cabin", "economy"),
    )

    stops_str = (
        "Nonstop" if card.best.stops == 0
        else f"{card.best.stops} stop{'s' if card.best.stops > 1 else ''}"
    )
    route = f"{card.best.origin}–{card.best.dest_iata}"

    if img_url:
        img_html = f"<img src='{img_url}' alt='{card.dest_label}' />"
    else:
        img_html = "<div class='placeholder-img'>✈️</div>"

    city, _, country = card.dest_label.partition(",")
    country_html = (
        f"<span class='card-country'>{country.strip()}</span>" if country.strip() else ""
    )

    stale_html = ""
    if card.best.stale:
        stale_html = "<div class='stale-banner'>⚠️ Prices may be outdated — confirm on Google Flights.</div>"

    # Show the chosen depart/return dates if a flexible query produced this card.
    date_line = f"<b>{card.best.depart_date}</b>"
    if card.best.return_date:
        date_line += f" — <b>{card.best.return_date}</b>"
    if len(parsed.get("depart_dates", [])) > 1:
        date_line += " <span class='flex-badge'>best of " + str(len(parsed["depart_dates"])) + "</span>"

    card_html = f"""
    <a class='book-link' href='{book_url}' target='_blank' rel='noopener'>
      <div class='card'>
        <div class='card-img-wrap'>
          {img_html}
          <div class='card-img-overlay'>
            <div class='card-title'>{city.strip()}{country_html}</div>
          </div>
        </div>
        <div class='card-body'>
          <div class='card-meta'>
            {date_line}<br>
            {card.best.airline or 'Multiple airlines'} · {stops_str}{' · ' + card.best.duration if card.best.duration else ''}<br>
            <span style='color:#888'>{route}</span>
            <div class='card-source'>via {card.best.source}</div>
          </div>
          <div class='card-price'>{card.best.price_display}</div>
        </div>
      </div>
    </a>
    {stale_html}
    """
    st.markdown(card_html, unsafe_allow_html=True)

    if card.alternates:
        with st.expander(f"Other options for {city.strip()} ({len(card.alternates)})"):
            for alt in card.alternates:
                alt_url = deeplink.booking_url(
                    origin=alt.origin,
                    dest=alt.dest_iata,
                    depart=alt.depart_date,
                    ret=alt.return_date,
                    pax=int(parsed.get("pax", 1)),
                    cabin=parsed.get("cabin", "economy"),
                )
                dates = alt.depart_date + (f" → {alt.return_date}" if alt.return_date else "")
                st.markdown(
                    f"- [{alt.origin}–{alt.dest_iata}]({alt_url}) · {dates} · "
                    f"{alt.airline or 'Multi'} · {alt.stops} stops · "
                    f"{alt.duration} · **{alt.price_display}**"
                )


# ---------- run ----------------------------------------------------------

if search_clicked and query.strip():
    run_search(query.strip())
elif not search_clicked:
    st.markdown(
        """
        <div style='text-align:center; color:#666; margin-top:3rem;'>
          <p><b>Try these:</b></p>
          <p><i>cheapest flights to malaysia return in july for 2 weeks</i></p>
          <p><i>flights from lahore to japan and thailand next month</i></p>
          <p><i>one-way to istanbul mid august</i></p>
          <p><i>show me flights to nepal malaysia thailand philippines indonesia and japan going 25th july coming back 25th august</i></p>
        </div>
        """,
        unsafe_allow_html=True,
    )
