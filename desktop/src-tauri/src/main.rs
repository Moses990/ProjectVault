#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::thread;

use tauri::{Manager, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

struct BackendProcess(Mutex<Option<CommandChild>>);

fn find_free_port() -> std::io::Result<u16> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    Ok(listener.local_addr()?.port())
}

fn start_backend(app: &tauri::App, port: u16) -> Result<CommandChild, String> {
    let parent_pid = std::process::id().to_string();
    let (_events, child) = app
        .shell()
        .sidecar("project-vault-backend")
        .map_err(|error| error.to_string())?
        .args(["--host", "127.0.0.1", "--port"])
        .arg(port.to_string())
        .args(["--parent-pid", &parent_pid])
        .spawn()
        .map_err(|error| error.to_string())?;

    Ok(child)
}

fn response_headers(status: &str, content_type: &str, body_len: usize, frontend_port: u16) -> String {
    format!(
        "HTTP/1.1 {status}\r\n\
         Content-Length: {body_len}\r\n\
         Content-Type: {content_type}\r\n\
         Cache-Control: no-store\r\n\
         Connection: close\r\n\
         Content-Security-Policy: default-src 'self' 'unsafe-inline' 'unsafe-eval' http://127.0.0.1:{frontend_port}; connect-src http://127.0.0.1:*; img-src 'self' data: blob:; font-src 'self' data:\r\n\
         X-Content-Type-Options: nosniff\r\n\
         X-Frame-Options: DENY\r\n\
         Referrer-Policy: no-referrer\r\n\
         \r\n"
    )
}

fn route_to_asset_path(request_path: &str) -> String {
    let path = request_path.split('?').next().unwrap_or("/");
    let path = path.trim_start_matches('/');

    if path.is_empty() {
        return "/index.html".to_string();
    }

    if let Some(next_index) = path.find("_next/") {
        return format!("/{}", &path[next_index..]);
    }

    if path.ends_with('/') {
        return format!("/{path}index.html");
    }

    if path.contains('.') {
        return format!("/{path}");
    }

    format!("/{path}/index.html")
}

fn inject_backend_port(bytes: Vec<u8>, backend_port: u16) -> Vec<u8> {
    let html = match String::from_utf8(bytes) {
        Ok(html) => html,
        Err(error) => return error.into_bytes(),
    };
    let script = format!("<script>window.__BACKEND_PORT__ = {backend_port};</script>");
    html.replace("</head>", &format!("{script}</head>")).into_bytes()
}

fn extract_host_header(request: &str) -> Option<&str> {
    for line in request.lines().skip(1) {
        if line.is_empty() || line == "\r" {
            break;
        }
        if let Some(value) = line.strip_prefix("Host: ").or_else(|| line.strip_prefix("host: ")) {
            return Some(value.trim());
        }
    }
    None
}

fn serve_frontend_request<R: tauri::Runtime>(
    mut stream: TcpStream,
    asset_resolver: &tauri::AssetResolver<R>,
    backend_port: u16,
    frontend_port: u16,
) {
    let mut buffer = [0_u8; 2048];
    let Ok(bytes_read) = stream.read(&mut buffer) else {
        return;
    };
    if bytes_read == 0 {
        return;
    }

    let request = String::from_utf8_lossy(&buffer[..bytes_read]);
    let Some(request_line) = request.lines().next() else {
        return;
    };
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let request_path = parts.next().unwrap_or("/");

    // Host header validation — reject requests from non-local origins
    if let Some(host) = extract_host_header(&request) {
        let host_without_port = host.split(':').next().unwrap_or(host);
        if host_without_port != "127.0.0.1" && host_without_port != "localhost" {
            let body = b"Forbidden: invalid Host";
            let headers = response_headers("403 Forbidden", "text/plain; charset=utf-8", body.len(), frontend_port);
            let _ = stream.write_all(headers.as_bytes());
            let _ = stream.write_all(body);
            return;
        }
    }

    if method != "GET" && method != "HEAD" {
        let body = b"Method Not Allowed";
        let headers = response_headers("405 Method Not Allowed", "text/plain; charset=utf-8", body.len(), frontend_port);
        let _ = stream.write_all(headers.as_bytes());
        if method != "HEAD" {
            let _ = stream.write_all(body);
        }
        return;
    }

    let requested_asset_path = route_to_asset_path(request_path);
    let asset = asset_resolver
        .get(requested_asset_path.clone())
        .map(|asset| (asset, requested_asset_path))
        .or_else(|| {
            asset_resolver
                .get("/index.html".to_string())
                .map(|asset| (asset, "/index.html".to_string()))
        });

    match asset {
        Some((asset, served_asset_path)) => {
            let mut body = asset.bytes;
            if served_asset_path.ends_with(".html") {
                body = inject_backend_port(body, backend_port);
            }
            let headers = response_headers("200 OK", &asset.mime_type, body.len(), frontend_port);
            let _ = stream.write_all(headers.as_bytes());
            if method != "HEAD" {
                let _ = stream.write_all(&body);
            }
        }
        None => {
            let body = b"Not Found";
            let headers = response_headers("404 Not Found", "text/plain; charset=utf-8", body.len(), frontend_port);
            let _ = stream.write_all(headers.as_bytes());
            if method != "HEAD" {
                let _ = stream.write_all(body);
            }
        }
    }
}

fn start_frontend_server(app: &tauri::App, backend_port: u16) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    let port = listener.local_addr().map_err(|error| error.to_string())?.port();
    let asset_resolver = app.asset_resolver();

    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            serve_frontend_request(stream, &asset_resolver, backend_port, port);
        }
    });

    Ok(port)
}

fn stop_backend(state: &BackendProcess) {
    if let Ok(mut backend) = state.0.lock() {
        if let Some(child) = backend.take() {
            let process_id = child.pid();
            let _ = Command::new("taskkill")
                .args(["/PID", &process_id.to_string(), "/T", "/F"])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
            let _ = child.kill();
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            let backend_port = find_free_port().map_err(|error| error.to_string())?;
            let frontend_port = start_frontend_server(app, backend_port)?;
            let child = start_backend(app, backend_port)?;

            let state = app.state::<BackendProcess>();
            *state.0.lock().map_err(|error| error.to_string())? = Some(child);

            let frontend_url = Url::parse(&format!("http://127.0.0.1:{frontend_port}/"))
                .map_err(|error| error.to_string())?;
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(frontend_url))
                .title("Project Vault")
                .inner_size(1280.0, 800.0)
                .min_inner_size(1024.0, 680.0)
                .build()
                .map_err(|error| error.to_string())?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                let state = window.state::<BackendProcess>();
                stop_backend(&state);
            }
        })
        .build(tauri::generate_context!())
        .expect("failed to build Project Vault desktop app")
        .run(|app_handle, event| {
            if matches!(event, tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit) {
                let state = app_handle.state::<BackendProcess>();
                stop_backend(&state);
            }
        });
}
