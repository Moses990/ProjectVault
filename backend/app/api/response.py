def success_response(
    data: object,
    message: str = "ok",
    meta: dict[str, object] | None = None,
) -> dict[str, object]:
    return {
        "status": "success",
        "data": data,
        "message": message,
        "meta": meta or {},
    }


def page_meta(page: int, limit: int, total: int) -> dict[str, object]:
    return {"page": page, "limit": limit, "total": total}
