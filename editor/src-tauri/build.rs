fn main() {
    println!("cargo:rerun-if-env-changed=SLATE_ENV");
    let environment = if std::env::var("SLATE_ENV")
        .unwrap_or_default()
        .trim()
        .eq_ignore_ascii_case("qa")
    {
        "qa"
    } else {
        "prod"
    };
    println!("cargo:rustc-env=SLATE_BUILD_ENV={environment}");
    if environment == "qa" {
        let manifest = std::path::PathBuf::from(std::env::var_os("CARGO_MANIFEST_DIR").unwrap());
        let expected = manifest
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .join(".qa/target");
        let actual = std::path::PathBuf::from(
            std::env::var_os("CARGO_TARGET_DIR").expect("QA requires CARGO_TARGET_DIR"),
        );
        assert_eq!(
            actual.canonicalize().unwrap(),
            expected.canonicalize().unwrap(),
            "QA must use .qa/target"
        );
        if let Ok(normal) = manifest.join("target").canonicalize() {
            assert!(
                !actual.canonicalize().unwrap().starts_with(normal),
                "QA target must not redirect to the development target"
            );
        }
    }
    tauri_build::build()
}
