"""
Mock stream generator — produces synthetic financial/geopolitical news events
with embedded named entities and sentiment signals.
"""
import random
import uuid
from datetime import datetime, timezone
from faker import Faker

fake = Faker()

COMPANIES = [
    "Tesla", "NVIDIA", "Apple", "Microsoft", "Alphabet",
    "Amazon", "Meta", "OpenAI", "Anthropic", "SpaceX",
    "Goldman Sachs", "JPMorgan", "BlackRock", "Palantir",
    "Lockheed Martin", "Boeing", "TSMC", "Samsung", "Intel",
    "DeepMind", "ByteDance", "Alibaba", "SoftBank", "Aramco",
]

PEOPLE = [
    "Elon Musk", "Sam Altman", "Sundar Pichai", "Satya Nadella",
    "Jensen Huang", "Mark Zuckerberg", "Tim Cook", "Jeff Bezos",
    "Dario Amodei", "Demis Hassabis", "Yann LeCun", "Altman Reid",
    "Janet Yellen", "Jerome Powell", "Christine Lagarde",
]

POSITIVE_TEMPLATES = [
    "{company} reports record Q{q} earnings, beating analyst forecasts by {pct}%",
    "{person} praises {company}'s breakthrough in {tech} technology",
    "{company} and {company2} announce strategic merger valued at ${val}B",
    "{company} secures ${val}B government contract for defense systems",
    "{person} appointed CEO of {company}, shares surge {pct}%",
    "{company} launches next-gen {tech} chip, outperforms rivals by {pct}%",
    "Investors rally behind {company} after {person} endorsement",
    "{company} IPO surges {pct}% on opening day amid tech optimism",
    "{person} calls {company} the 'most important company' of the decade",
    "{company} wins regulatory approval for {tech} platform expansion",
]

NEGATIVE_TEMPLATES = [
    "{company} faces DOJ antitrust investigation over {tech} monopoly claims",
    "{person} resigns from {company} board amid internal governance crisis",
    "{company} stock plummets {pct}% following data breach disclosure",
    "Regulators fine {company} ${val}B over {tech} privacy violations",
    "{company} lays off {pct}% of workforce as AI threatens {tech} sector",
    "{person} denies insider trading allegations linked to {company} sale",
    "{company} misses Q{q} revenue targets by ${val}B, shares crater",
    "Senate hearing targets {company} and {person} over {tech} safety failures",
    "{company} recalls {tech} products after safety scandal goes viral",
    "Whistleblower alleges {company} manipulated {tech} benchmarks under {person}",
]

NEUTRAL_TEMPLATES = [
    "{company} partners with {company2} to research {tech} applications",
    "{person} speaks at {city} summit on the future of {tech}",
    "{company} files {pct} new {tech} patents this quarter",
    "{company} relocates {tech} division headquarters to {city}",
    "{person} joins {company2} advisory board after leaving {company}",
]

TECH_DOMAINS = [
    "AI", "quantum computing", "semiconductor", "autonomous vehicle",
    "blockchain", "satellite", "defense", "renewable energy",
    "biotech", "cloud infrastructure", "5G", "robotics",
]


def _pick(lst, exclude=None):
    choices = [x for x in lst if x != exclude]
    return random.choice(choices)


def generate_event() -> dict:
    sentiment_bias = random.random()
    if sentiment_bias > 0.6:
        template = random.choice(POSITIVE_TEMPLATES)
        base_sentiment = random.uniform(0.3, 0.95)
    elif sentiment_bias < 0.35:
        template = random.choice(NEGATIVE_TEMPLATES)
        base_sentiment = random.uniform(-0.95, -0.3)
    else:
        template = random.choice(NEUTRAL_TEMPLATES)
        base_sentiment = random.uniform(-0.15, 0.15)

    company = _pick(COMPANIES)
    company2 = _pick(COMPANIES, exclude=company)
    person = _pick(PEOPLE)
    tech = _pick(TECH_DOMAINS)
    city = fake.city()
    q = random.randint(1, 4)
    pct = random.randint(5, 40)
    val = round(random.uniform(0.5, 150), 1)

    headline = template.format(
        company=company, company2=company2, person=person,
        tech=tech, city=city, q=q, pct=pct, val=val,
    )

    # Named entities extracted (pre-NER simulation)
    entities = []
    if company in headline:
        entities.append({"name": company, "type": "ORG"})
    if company2 in headline:
        entities.append({"name": company2, "type": "ORG"})
    if person in headline:
        entities.append({"name": person, "type": "PERSON"})

    # Add noise to sentiment
    sentiment = round(max(-1.0, min(1.0, base_sentiment + random.uniform(-0.1, 0.1))), 3)

    return {
        "id": str(uuid.uuid4()),
        "headline": headline,
        "source": random.choice([
            "Reuters", "Bloomberg", "WSJ", "FT", "TechCrunch",
            "Axios", "The Information", "CNBC", "AP News",
        ]),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "entities": entities,
        "sentiment": sentiment,
        "raw_text": headline,
    }
