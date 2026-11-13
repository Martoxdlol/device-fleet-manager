fn main() -> Result<(), Box<dyn std::error::Error>> {
    let (_router, api) = fleet_server::build_router().split_for_parts();
    let document = api.to_pretty_json()?;

    match std::env::args().nth(1) {
        Some(path) => {
            std::fs::write(&path, format!("{document}\n"))?;
            eprintln!("wrote {path}");
        }
        None => println!("{document}"),
    }

    Ok(())
}
