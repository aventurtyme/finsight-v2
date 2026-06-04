def build_prompt(ticker: str, price_data: dict, news: list[dict]) -> str:
    """
    Constructs the user prompt for Gemini using structured financial data.
    The system prompt is handled separately in gemini.py.
    """
    headlines_text = _format_headlines(news)

    return f"""Analyze the following company and return a JSON report.

Company: {price_data['company_name']} ({ticker})
Current Price: ${price_data['current_price']} | P/E Ratio: {price_data['pe_ratio'] or 'N/A'} | Market Cap: {price_data['market_cap']}
52W High: {price_data['week_52_high']} | 52W Low: {price_data['week_52_low']}
1-Day Change: {price_data['price_change_pct']}% | YTD Change: {price_data.get('ytd_change', 0)}%

Recent News Headlines:
{headlines_text}

Based on all of the above, generate the JSON report."""


def _format_headlines(news: list[dict]) -> str:
    if not news:
        return "No recent news available."
    lines = []
    for i, article in enumerate(news[:10], 1):
        date = article['published_at'][:10] if article.get('published_at') else "N/A"
        lines.append(f"{i}. [{article['source']}] {article['title']} ({date})")
    return "\n".join(lines)