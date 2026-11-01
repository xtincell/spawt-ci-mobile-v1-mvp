#!/usr/bin/env python3
"""Encrypt private Android pitch evidence for a local-only RSA recipient.

Only the authenticated ciphertext and its key envelope may leave the runner.
The recipient private key is neither accepted nor required by this script.
"""

import argparse
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import zipfile


def seal(input_dir: Path, recipient: Path, recipient_sha256: str, output_dir: Path) -> None:
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding, rsa

    if not re.fullmatch(r"[0-9a-f]{64}", recipient_sha256):
        raise ValueError("Invalid recipient fingerprint")
    public_pem = recipient.read_bytes()
    if hashlib.sha256(public_pem).hexdigest() != recipient_sha256:
        raise ValueError("Recipient fingerprint mismatch")
    public_key = serialization.load_pem_public_key(public_pem)
    if not isinstance(public_key, rsa.RSAPublicKey) or public_key.key_size < 3072:
        raise ValueError("An RSA public key of at least 3072 bits is required")

    if input_dir.is_symlink() or not input_dir.is_dir():
        raise ValueError("Evidence directory is unavailable")
    source = input_dir.resolve(strict=True)
    target = output_dir.resolve()
    if target == source or source in target.parents:
        raise ValueError("Output must be outside the evidence directory")
    files = []
    for path in sorted(source.rglob("*")):
        if path.is_symlink():
            raise ValueError("Evidence symlinks are not accepted")
        if path.is_dir():
            continue
        if not path.is_file():
            raise ValueError("Evidence must contain regular files only")
        files.append(path)
    if not files:
        raise ValueError("No evidence to seal")

    # No plaintext ZIP is written to the output directory or to disk.
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for path in files:
            bundle.write(path, "android-proof/" + path.relative_to(source).as_posix())
    fernet_key = Fernet.generate_key()
    ciphertext = Fernet(fernet_key).encrypt(archive.getvalue())
    wrapped_key = public_key.encrypt(
        fernet_key,
        padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None),
    )
    # This envelope deliberately omits filenames, capture counts and plaintext
    # hashes. Its only payload-dependent metadata describes the ciphertext.
    envelope = {
        "schemaVersion": 1,
        "kind": "spawt-android-pitch-sealed",
        "archiveFormat": "zip",
        "encryption": "Fernet",
        "keyWrapping": "RSA-OAEP-SHA256",
        "recipientPublicKeyPemSha256": recipient_sha256,
        "wrappedFernetKeyBase64": base64.b64encode(wrapped_key).decode("ascii"),
        "ciphertext": {
            "fileName": "android-pitch.bin",
            "bytes": len(ciphertext),
            "sha256": hashlib.sha256(ciphertext).hexdigest(),
        },
    }

    output_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    if output_dir.is_symlink():
        raise ValueError("Output directory symlinks are not accepted")
    encrypted_file = output_dir / "android-pitch.bin"
    envelope_file = output_dir / "android-pitch.json"
    if encrypted_file.exists() or envelope_file.exists():
        raise ValueError("Refusing to replace an existing sealed bundle")
    # Final names appear only after all cryptographic work succeeds. A failed
    # workflow step must never upload even a partly completed encrypted pair.
    with tempfile.TemporaryDirectory(prefix=".seal-", dir=output_dir) as staging:
        temporary = Path(staging)
        (temporary / encrypted_file.name).write_bytes(ciphertext)
        (temporary / envelope_file.name).write_text(json.dumps(envelope, indent=2) + "\n", encoding="utf-8")
        os.chmod(temporary / encrypted_file.name, 0o600)
        os.chmod(temporary / envelope_file.name, 0o600)
        os.replace(temporary / encrypted_file.name, encrypted_file)
        os.replace(temporary / envelope_file.name, envelope_file)


def main() -> int:
    parser = argparse.ArgumentParser(description="Seal Android pitch evidence with an RSA public key.")
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--recipient", type=Path, required=True)
    parser.add_argument("--recipient-sha256", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        seal(args.input_dir, args.recipient, args.recipient_sha256, args.output_dir)
    except Exception:
        # Never print paths, exception text, archive contents, or traceback.
        print("Pitch sealing failed; no evidence artifact is authorized for upload.", file=sys.stderr)
        return 1
    print("Pitch encrypted bundle ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
