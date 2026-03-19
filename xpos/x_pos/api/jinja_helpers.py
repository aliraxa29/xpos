# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

"""Jinja template helpers for barcode and QR code generation.

These functions are registered via ``hooks.py`` under ``jenv`` so they can
be called directly in Jinja / Print Format templates:

    {{ xpos_barcode("12345", barcode_type="code128") }}
    {{ xpos_qrcode("https://example.com") }}
    {{ xpos_item_barcode("ITEM-001") }}
"""

from __future__ import annotations

from xpos.x_pos.api.barcode_generator import (
    generate_barcode,
    generate_qrcode,
    generate_item_barcode_label,
)


def xpos_barcode(
    value: str,
    barcode_type: str = "code128",
    width: float = 0.4,
    height: float = 15.0,
    font_size: int = 10,
    show_text: bool = True,
    fmt: str = "png",
) -> str:
    """Jinja helper: Generate a barcode and return as an ``<img>`` tag.

    Usage in Jinja:
        {{ xpos_barcode("1234567890128", barcode_type="ean13") }}
    """
    data_uri = generate_barcode(
        value,
        barcode_type=barcode_type,
        width=width,
        height=height,
        font_size=font_size,
        show_text=show_text,
        fmt=fmt,
    )
    if not data_uri:
        return ""
    return f'<img src="{data_uri}" alt="Barcode {value}" style="max-width:100%;height:auto;" />'


def xpos_barcode_uri(
    value: str,
    barcode_type: str = "code128",
    width: float = 0.4,
    height: float = 15.0,
    font_size: int = 10,
    show_text: bool = True,
    fmt: str = "png",
) -> str:
    """Jinja helper: Generate a barcode and return the raw data URI string.

    Useful when you need to set the ``src`` attribute yourself:
        <img src="{{ xpos_barcode_uri('123') }}" style="width:50mm;" />
    """
    return generate_barcode(
        value,
        barcode_type=barcode_type,
        width=width,
        height=height,
        font_size=font_size,
        show_text=show_text,
        fmt=fmt,
    )


def xpos_qrcode(
    value: str,
    size: int = 4,
    border: int = 2,
    error_correction: str = "M",
    fmt: str = "png",
) -> str:
    """Jinja helper: Generate a QR code and return as an ``<img>`` tag.

    Usage in Jinja:
        {{ xpos_qrcode(doc.name) }}
    """
    data_uri = generate_qrcode(
        value,
        size=size,
        border=border,
        error_correction=error_correction,
        fmt=fmt,
    )
    if not data_uri:
        return ""
    return f'<img src="{data_uri}" alt="QR Code" style="max-width:100%;height:auto;" />'


def xpos_qrcode_uri(
    value: str,
    size: int = 4,
    border: int = 2,
    error_correction: str = "M",
    fmt: str = "png",
) -> str:
    """Jinja helper: Generate a QR code and return the raw data URI string."""
    return generate_qrcode(
        value,
        size=size,
        border=border,
        error_correction=error_correction,
        fmt=fmt,
    )


def xpos_item_barcode(
    item_code: str,
    barcode_type: str = "code128",
    include_qr: bool = False,
    width: float = 0.4,
    height: float = 15.0,
) -> dict:
    """Jinja helper: Return full barcode label data for an item.

    Usage in Jinja:
        {% set label = xpos_item_barcode("ITEM-001", include_qr=True) %}
        <img src="{{ label.barcode_uri }}" />
        <p>{{ label.item_name }} - {{ label.price }} {{ label.currency }}</p>
    """
    return generate_item_barcode_label(
        item_code=item_code,
        barcode_type=barcode_type,
        include_qr=include_qr,
        width=width,
        height=height,
    )
