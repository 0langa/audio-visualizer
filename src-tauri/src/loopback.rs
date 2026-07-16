//! WASAPI loopback capture: tap whatever the default output device is
//! playing (Spotify, a browser, a DAW) and stream it to the webview for
//! live visualization. cpal builds an INPUT stream on a RENDER device,
//! which on Windows sets AUDCLNT_STREAMFLAGS_LOOPBACK — the OS mixes it
//! for us, we just forward samples.
//!
//! Live-only by design: nothing here touches the export pipeline, and the
//! webview feeds these samples into analysers only (never the speakers —
//! that would feed the system output back into itself).

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::Serialize;
use std::sync::{mpsc, Mutex};
use tauri::ipc::{Channel, InvokeResponseBody};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopbackInfo {
    pub sample_rate: u32,
    pub channels: u16,
    pub device: String,
}

/// Handle to the capture thread. The cpal Stream itself is !Send, so a
/// dedicated thread owns it; dropping the sender (or sending ()) unparks the
/// thread, which drops the stream and exits.
pub struct LoopbackCtl(pub Mutex<Option<mpsc::Sender<()>>>);

impl Default for LoopbackCtl {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

/// Convert one interleaved device-channel callback buffer to interleaved
/// STEREO f32 little-endian bytes (mono duplicates, >2ch takes the front
/// pair — the visualizer's analysis graph is stereo).
fn to_stereo_le_bytes(data: &[f32], channels: usize) -> Vec<u8> {
    let ch = channels.max(1);
    let frames = data.len() / ch;
    let mut out = Vec::with_capacity(frames * 2 * 4);
    for f in 0..frames {
        let base = f * ch;
        let l = data[base];
        let r = if ch > 1 { data[base + 1] } else { l };
        out.extend_from_slice(&l.to_le_bytes());
        out.extend_from_slice(&r.to_le_bytes());
    }
    out
}

#[tauri::command]
pub fn start_loopback(
    state: tauri::State<'_, LoopbackCtl>,
    on_samples: Channel<InvokeResponseBody>,
) -> Result<LoopbackInfo, String> {
    let mut guard = state.0.lock().map_err(|_| "loopback state poisoned")?;
    if guard.is_some() {
        return Err("System-audio capture is already running".into());
    }

    let host = cpal::default_host();
    let device = host
        .default_output_device()
        .ok_or("No default output device")?;
    let device_name = device
        .description()
        .map(|d| d.to_string())
        .unwrap_or_else(|_| "output device".into());
    let config = device.default_output_config().map_err(|e| e.to_string())?;
    if config.sample_format() != cpal::SampleFormat::F32 {
        // WASAPI shared-mode mix format is f32 in practice; refuse anything
        // exotic rather than mis-interpreting bytes.
        return Err(format!(
            "Unsupported device sample format {:?}",
            config.sample_format()
        ));
    }
    let sample_rate = config.sample_rate();
    let channels = config.channels();

    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();
    std::thread::spawn(move || {
        let ch = channels as usize;
        let stream = device.build_input_stream(
            config.into(),
            move |data: &[f32], _| {
                // A send failure means the webview side is gone; the stop
                // command will tear us down shortly — nothing to do here.
                let _ = on_samples.send(InvokeResponseBody::Raw(to_stereo_le_bytes(data, ch)));
            },
            |e| eprintln!("[loopback] stream error: {e}"),
            None,
        );
        match stream {
            Ok(s) => {
                if let Err(e) = s.play() {
                    let _ = ready_tx.send(Err(e.to_string()));
                    return;
                }
                let _ = ready_tx.send(Ok(()));
                // Park until stop (send OR sender drop both wake us).
                let _ = stop_rx.recv();
                drop(s);
            }
            Err(e) => {
                let _ = ready_tx.send(Err(e.to_string()));
            }
        }
    });
    ready_rx
        .recv()
        .map_err(|_| "Loopback thread died before reporting".to_string())??;

    *guard = Some(stop_tx);
    Ok(LoopbackInfo {
        sample_rate,
        channels,
        device: device_name,
    })
}

#[tauri::command]
pub fn stop_loopback(state: tauri::State<'_, LoopbackCtl>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "loopback state poisoned")?;
    if let Some(tx) = guard.take() {
        let _ = tx.send(()); // thread drops the stream and exits
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn floats(bytes: &[u8]) -> Vec<f32> {
        bytes
            .chunks_exact(4)
            .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
            .collect()
    }

    #[test]
    fn stereo_passes_through() {
        let out = to_stereo_le_bytes(&[0.1, -0.2, 0.3, -0.4], 2);
        assert_eq!(floats(&out), vec![0.1, -0.2, 0.3, -0.4]);
    }

    #[test]
    fn mono_duplicates() {
        let out = to_stereo_le_bytes(&[0.5, -0.5], 1);
        assert_eq!(floats(&out), vec![0.5, 0.5, -0.5, -0.5]);
    }

    #[test]
    fn surround_takes_front_pair() {
        // 5.1 frame: FL FR C LFE RL RR
        let out = to_stereo_le_bytes(&[0.1, 0.2, 9.0, 9.0, 9.0, 9.0], 6);
        assert_eq!(floats(&out), vec![0.1, 0.2]);
    }
}
