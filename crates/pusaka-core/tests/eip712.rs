use pusaka_core::eip712::{
    Domain, Pencabutan, Penerbitan, digest_pencabutan, digest_penerbitan, domain_separator,
    struct_hash_penerbitan,
};
use pusaka_core::hash::keccak256;
use pusaka_core::heks::{alamat, ke_hex};

const URI: &str = "ipfs://bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";

fn domain() -> Domain {
    Domain {
        chain_id: 31337,
        kontrak: alamat("0x5FbDB2315678afecb367f032d93F642f64180aa3").unwrap(),
    }
}

fn penerbitan() -> Penerbitan {
    Penerbitan {
        penerima: alamat("0x70997970C51812dc3A010C7d01b50e0d17dc79C8").unwrap(),
        doc_hash: keccak256(b"%PDF-1.7 ijazah PUSAKA"),
        metadata_hash: keccak256(URI.as_bytes()),
        batas_waktu: 1_793_000_000,
    }
}

#[test]
fn domain_separator_sama_dengan_ethers() {
    assert_eq!(
        ke_hex(&domain_separator(&domain())),
        "0x234afa7e8e5a1ef9ad82593a023f56bd249579702732f95795cd18b5e39ed04c"
    );
}

#[test]
fn penerbitan_sama_dengan_ethers() {
    let p = penerbitan();
    assert_eq!(
        ke_hex(&p.metadata_hash),
        "0x14ecfb0c60c4bdfac4451a0238994b0b8024f8e018440289db82f5b6e4cf9e5f"
    );
    assert_eq!(
        ke_hex(&struct_hash_penerbitan(&p)),
        "0x745f7ca1ca905ff314fb499063eb5505a76efae516d39a3670adfd8e89c9dfc5"
    );
    assert_eq!(
        ke_hex(&digest_penerbitan(&domain(), &p)),
        "0x069e362cc547e60dc1beb36e2f4502c5e07a3689275ac21faaaa791b024f9be5"
    );
}

#[test]
fn pencabutan_sama_dengan_ethers() {
    let c = Pencabutan {
        token_id: 7,
        alasan_hash: keccak256("salah nama ibu".as_bytes()),
        batas_waktu: 1_793_000_000,
    };
    assert_eq!(
        ke_hex(&c.alasan_hash),
        "0xb0e811a06cdecac05b2c76b58d65333b5a96d4666441412f169bc50020178302"
    );
    assert_eq!(
        ke_hex(&digest_pencabutan(&domain(), &c)),
        "0xd9bc14d3408df457dab6f74a5d04e5c5768e3526573c85bbf7080d0ae73e8bc6"
    );
}

#[test]
fn chain_berbeda_digest_berbeda() {
    let lain = Domain {
        chain_id: 80002,
        ..domain()
    };
    assert_ne!(
        digest_penerbitan(&lain, &penerbitan()),
        digest_penerbitan(&domain(), &penerbitan())
    );
}
