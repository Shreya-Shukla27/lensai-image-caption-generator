# Image Caption Generator — Complete Build Guide

## Time Estimate
| Phase | Task | Time |
|---|---|---|
| Day 1 | Setup + Cloudinary + Backend skeleton | 3–4 hrs |
| Day 2 | Caption API route + HuggingFace integration | 3–4 hrs |
| Day 3 | React frontend (upload + result UI) | 4–5 hrs |
| Day 4 | Auth (JWT) + MongoDB history | 3–4 hrs |
| Day 5 | Polish + deploy + README | 2–3 hrs |
| **Total** | | **~18–20 hrs** |

## Tools You Need
- VS Code (editor)
- Node.js v18+ (nodejs.org)
- MongoDB Atlas account (free) — mongodb.com/atlas
- Cloudinary account (free) — cloudinary.com
- HuggingFace account (free) — huggingface.co → get API token
- Git + GitHub
- Postman (API testing) — postman.com

## No Dataset Needed
This project uses a pre-trained model (BLIP) via HuggingFace API.
No training required — just call the API with an image URL.
