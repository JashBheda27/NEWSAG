import re
import numpy as np
from typing import List
from sklearn.feature_extraction.text import TfidfVectorizer


class TextSummarizer:
    """
    High-quality extractive NLP summarizer (NO AI / NO APIs)
    Optimized for news articles.
    """

    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            stop_words="english",
            ngram_range=(1, 2),
            max_df=0.85,
            min_df=2
        )

    def summarize(
        self,
        text: str,
        *,
        min_words: int = 100,
        max_words: int = 120,
        max_sentences: int = 10,
    ) -> str:
        sentences = self._split_sentences(text)

        if not sentences:
            return ""

        full_text = " ".join(sentences).strip()

        # Avoid TF-IDF empty vocabulary errors when too few sentences
        if len(sentences) < 2:
            return full_text

        if len(full_text.split()) <= min_words:
            return full_text

        try:
            scores = self._score(sentences)
        except ValueError:
            return full_text

        ranked = np.argsort(scores)[::-1]

        selected = []
        used_words = set()
        word_count = 0

        for idx in ranked:
            sentence = sentences[idx]
            words = set(sentence.lower().split())

            # ❌ Skip highly redundant sentences
            overlap = len(words & used_words) / max(len(words), 1)
            if overlap > 0.6:
                continue

            selected.append((idx, sentence))
            used_words |= words
            word_count += len(sentence.split())

            if word_count >= min_words or len(selected) >= max_sentences:
                break

        selected.sort(key=lambda x: x[0])

        summary = " ".join(s for _, s in selected)
        words = summary.split()

        if len(words) > max_words:
            summary = " ".join(words[:max_words]).rstrip() + "…"

        return summary

    # --------------------------------------------------
    # Helpers
    # --------------------------------------------------

    def _split_sentences(self, text: str) -> List[str]:
        text = re.sub(r"\s+", " ", text)
        sentences = re.split(r"(?<=[.!?])\s+", text)
        return [
            s.strip()
            for s in sentences
            if len(s.strip()) > 50
        ]

    def _score(self, sentences: List[str]) -> np.ndarray:
        tfidf = self.vectorizer.fit_transform(sentences)
        scores = tfidf.sum(axis=1).A1

        # 📰 Strong lead bias (news articles)
        lead_bias = np.linspace(1.6, 0.7, len(scores))
        scores *= lead_bias

        return scores
