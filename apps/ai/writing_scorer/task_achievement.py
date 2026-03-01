import numpy as np
from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer("all-MiniLM-L6-v2")


def compute_similarity(prompt: str, essay: str) -> float:
    prompt_emb = model.encode(prompt, convert_to_tensor=True)
    essay_emb = model.encode(essay, convert_to_tensor=True)
    return util.cos_sim(prompt_emb.unsqueeze(0), essay_emb.unsqueeze(0)).item()


def compute_similarity_batch(prompts: list[str], essays: list[str]) -> np.ndarray:
    """Encode all prompts and essays in batch, return pairwise cosine similarities."""
    prompt_embs = model.encode(prompts, convert_to_tensor=True, show_progress_bar=True)
    essay_embs = model.encode(essays, convert_to_tensor=True, show_progress_bar=True)
    sims = util.cos_sim(prompt_embs, essay_embs)
    return sims.diagonal().cpu().numpy()


def score_task(prompt: str, essay: str) -> float:
    similarity = compute_similarity(prompt, essay)
    return round(max(1.0, min(9.0, similarity * 9.0)), 1)
