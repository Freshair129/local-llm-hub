use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::task::JoinHandle;

pub(crate) struct FixtureReply {
    pub status: u16,
    pub body: String,
}

impl FixtureReply {
    pub(crate) fn json(status: u16, body: impl Into<String>) -> Self {
        Self {
            status,
            body: body.into(),
        }
    }
}

pub(crate) async fn spawn_json_http_fixture(
    replies: Vec<FixtureReply>,
) -> (String, JoinHandle<Vec<String>>) {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind local HTTP fixture");
    let address = listener.local_addr().expect("read fixture address");
    let task = tokio::spawn(async move {
        let mut requests = Vec::with_capacity(replies.len());
        for reply in replies {
            let (mut stream, _) = listener.accept().await.expect("accept fixture request");
            let request = read_request(&mut stream).await;
            requests.push(request);

            let reason = if reply.status < 400 {
                "OK"
            } else {
                "Service Unavailable"
            };
            let response = format!(
                "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                reply.status,
                reason,
                reply.body.len(),
                reply.body
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("write fixture response");
            stream.shutdown().await.expect("close fixture response");
        }
        requests
    });

    (format!("http://{address}"), task)
}

async fn read_request(stream: &mut TcpStream) -> String {
    let mut bytes = Vec::new();
    let mut chunk = [0_u8; 2048];
    loop {
        let read = stream.read(&mut chunk).await.expect("read fixture request");
        if read == 0 {
            break;
        }
        bytes.extend_from_slice(&chunk[..read]);

        let text = String::from_utf8_lossy(&bytes);
        let Some(header_end) = text.find("\r\n\r\n") else {
            continue;
        };
        let content_length = text[..header_end]
            .lines()
            .find_map(|line| {
                let (name, value) = line.split_once(':')?;
                name.eq_ignore_ascii_case("content-length")
                    .then(|| value.trim().parse::<usize>().ok())
                    .flatten()
            })
            .unwrap_or(0);
        if bytes.len() >= header_end + 4 + content_length {
            break;
        }
    }
    String::from_utf8_lossy(&bytes).into_owned()
}
