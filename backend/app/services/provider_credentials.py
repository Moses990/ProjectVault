"""Windows Credential Manager storage for AI provider API keys."""

from __future__ import annotations

import ctypes
import os
from ctypes import wintypes

_CRED_TYPE_GENERIC = 1
_CRED_PERSIST_LOCAL_MACHINE = 2
_ERROR_NOT_FOUND = 1168
_REFERENCE_PREFIX = "wincred:"
_TARGET_PREFIX = "ProjectVault.AIProvider:"


class _Credential(ctypes.Structure):
    _fields_ = [
        ("Flags", wintypes.DWORD),
        ("Type", wintypes.DWORD),
        ("TargetName", ctypes.c_wchar_p),
        ("Comment", ctypes.c_wchar_p),
        ("LastWritten", wintypes.FILETIME),
        ("CredentialBlobSize", wintypes.DWORD),
        ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
        ("Persist", wintypes.DWORD),
        ("AttributeCount", wintypes.DWORD),
        ("Attributes", ctypes.c_void_p),
        ("TargetAlias", ctypes.c_wchar_p),
        ("UserName", ctypes.c_wchar_p),
    ]


def _reference(provider_id: str) -> str:
    return f"{_REFERENCE_PREFIX}{provider_id}"


def _target(provider_id: str) -> str:
    return f"{_TARGET_PREFIX}{provider_id}"


def _advapi32() -> ctypes.WinDLL:
    if os.name != "nt":
        raise OSError("windows_credential_manager_unavailable")
    return ctypes.WinDLL("Advapi32.dll", use_last_error=True)


def is_managed_reference(provider_id: str, reference: str) -> bool:
    return reference == _reference(provider_id)


def store_secret(provider_id: str, secret: str) -> str:
    blob = secret.encode("utf-16-le")
    blob_buffer = ctypes.create_string_buffer(blob)
    credential = _Credential(
        Type=_CRED_TYPE_GENERIC,
        TargetName=_target(provider_id),
        CredentialBlobSize=len(blob),
        CredentialBlob=ctypes.cast(blob_buffer, ctypes.POINTER(ctypes.c_ubyte)),
        Persist=_CRED_PERSIST_LOCAL_MACHINE,
        UserName=provider_id,
    )
    advapi32 = _advapi32()
    advapi32.CredWriteW.argtypes = [ctypes.POINTER(_Credential), wintypes.DWORD]
    advapi32.CredWriteW.restype = wintypes.BOOL
    if not advapi32.CredWriteW(ctypes.byref(credential), 0):
        raise ctypes.WinError(ctypes.get_last_error())
    return _reference(provider_id)


def read_secret(provider_id: str, reference: str) -> str | None:
    if not is_managed_reference(provider_id, reference):
        return None
    credential_ptr = ctypes.POINTER(_Credential)()
    advapi32 = _advapi32()
    advapi32.CredReadW.argtypes = [
        ctypes.c_wchar_p,
        wintypes.DWORD,
        wintypes.DWORD,
        ctypes.POINTER(ctypes.POINTER(_Credential)),
    ]
    advapi32.CredReadW.restype = wintypes.BOOL
    advapi32.CredFree.argtypes = [ctypes.c_void_p]
    advapi32.CredFree.restype = None
    if not advapi32.CredReadW(_target(provider_id), _CRED_TYPE_GENERIC, 0, ctypes.byref(credential_ptr)):
        error = ctypes.get_last_error()
        if error == _ERROR_NOT_FOUND:
            return None
        raise ctypes.WinError(error)
    try:
        credential = credential_ptr.contents
        blob = ctypes.string_at(credential.CredentialBlob, credential.CredentialBlobSize)
        return blob.decode("utf-16-le")
    finally:
        advapi32.CredFree(credential_ptr)


def delete_secret(provider_id: str, reference: str) -> None:
    if not is_managed_reference(provider_id, reference):
        return
    advapi32 = _advapi32()
    advapi32.CredDeleteW.argtypes = [ctypes.c_wchar_p, wintypes.DWORD, wintypes.DWORD]
    advapi32.CredDeleteW.restype = wintypes.BOOL
    if not advapi32.CredDeleteW(_target(provider_id), _CRED_TYPE_GENERIC, 0):
        error = ctypes.get_last_error()
        if error != _ERROR_NOT_FOUND:
            raise ctypes.WinError(error)
