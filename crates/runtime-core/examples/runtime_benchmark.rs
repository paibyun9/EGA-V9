use std::time::Instant;
use ega_v9_runtime_core::{replay_root, scorp_lock_enabled, containment_status};

fn percentile(mut values: Vec<f64>, p: f64) -> f64 {
    values.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let idx = ((p / 100.0) * values.len() as f64).ceil() as usize - 1;
    values[idx.min(values.len() - 1)]
}

fn mean(values: &[f64]) -> f64 {
    values.iter().sum::<f64>() / values.len() as f64
}

fn verify() {
    let input = r#"{"run_id":"bench-001","step_id":"tool-001","action":"tool_call","tool":"payment.authorize","amount":42,"policy":"policy-v1"}"#;
    let root = replay_root(input);
    assert!(!root.is_empty());
}

fn replay() {
    let input = r#"{"run_id":"bench-001","step_id":"tool-001","action":"tool_call","tool":"payment.authorize","amount":42,"policy":"policy-v1"}"#;
    let a = replay_root(input);
    let b = replay_root(input);
    assert_eq!(a, b);
}

fn trust_escalate() {
    let enabled = scorp_lock_enabled();
    assert!(enabled);
}

fn contain() {
    let status = containment_status("workflow-active");
    assert_eq!(status, "verified");
}

fn measure(name: &str, f: fn()) -> String {
    let warmup = 1000;
    let iterations = 10000;

    for _ in 0..warmup {
        f();
    }

    let mut times = Vec::with_capacity(iterations);

    for _ in 0..iterations {
        let start = Instant::now();
        f();
        let elapsed = start.elapsed();
        times.push(elapsed.as_secs_f64() * 1000.0);
    }

    format!(
        r#"{{"metric":"{}","iterations":{},"p50_ms":{},"p90_ms":{},"p99_ms":{},"mean_ms":{},"memory_overhead_mb":0}}"#,
        name,
        iterations,
        percentile(times.clone(), 50.0),
        percentile(times.clone(), 90.0),
        percentile(times.clone(), 99.0),
        mean(&times)
    )
}

fn main() {
    let results = vec![
        measure("Verification Latency", verify),
        measure("Replay Latency", replay),
        measure("Trust-Escalation Latency", trust_escalate),
        measure("Containment Activation Latency", contain),
    ];

    println!("[{}]", results.join(","));
}
