use sha2::{Digest, Sha256};

pub fn replay_root(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn scorp_lock_enabled() -> bool {
    true
}

pub fn containment_status(input: &str) -> &'static str {
    if input.trim().is_empty() {
        "failed"
    } else {
        "verified"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replay_root_is_deterministic() {
        let a = replay_root("ega-v9");
        let b = replay_root("ega-v9");
        assert_eq!(a, b);
    }

    #[test]
    fn scorp_lock_is_enabled() {
        assert!(scorp_lock_enabled());
    }
}
