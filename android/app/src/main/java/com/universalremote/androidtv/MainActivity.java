package com.universalremote.androidtv;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WakeOnLanPlugin.class);
        super.onCreate(savedInstanceState);
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebSettings settings = getBridge().getWebView().getSettings();
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }
        } catch (Exception ignored) {
        }
    }

    @CapacitorPlugin(name = "WakeOnLanPlugin")
    public static class WakeOnLanPlugin extends Plugin {
        @PluginMethod
        public void sendWakeOnLan(PluginCall call) {
            String ip = call.getString("ip", "255.255.255.255");
            String mac = call.getString("mac", "");
            new Thread(() -> {
                try {
                    byte[] bytes = new byte[102];
                    for (int i = 0; i < 6; i++) {
                        bytes[i] = (byte) 0xff;
                    }
                    if (mac != null && !mac.isEmpty()) {
                        String cleanMac = mac.replaceAll("[:\\-]", "");
                        if (cleanMac.length() == 12) {
                            byte[] macBytes = new byte[6];
                            for (int i = 0; i < 6; i++) {
                                macBytes[i] = (byte) Integer.parseInt(cleanMac.substring(i * 2, i * 2 + 2), 16);
                            }
                            for (int i = 6; i < 102; i += 6) {
                                System.arraycopy(macBytes, 0, bytes, i, 6);
                            }
                        } else {
                            for (int i = 6; i < 102; i++) {
                                bytes[i] = (byte) 0xff;
                            }
                        }
                    } else {
                        for (int i = 6; i < 102; i++) {
                            bytes[i] = (byte) 0xff;
                        }
                    }

                    DatagramSocket socket = new DatagramSocket();
                    socket.setBroadcast(true);

                    // 1. Send direct to IP on ports 9 and 7
                    if (ip != null && !ip.isEmpty() && !ip.equals("255.255.255.255")) {
                        try {
                            InetAddress addr = InetAddress.getByName(ip);
                            socket.send(new DatagramPacket(bytes, bytes.length, addr, 9));
                            socket.send(new DatagramPacket(bytes, bytes.length, addr, 7));
                        } catch (Exception ignored) {}
                    }

                    // 2. Broadcast on 255.255.255.255 on ports 9 and 7
                    try {
                        InetAddress bcast = InetAddress.getByName("255.255.255.255");
                        socket.send(new DatagramPacket(bytes, bytes.length, bcast, 9));
                        socket.send(new DatagramPacket(bytes, bytes.length, bcast, 7));
                    } catch (Exception ignored) {}

                    socket.close();
                    call.resolve();
                } catch (Exception e) {
                    call.reject(e.getMessage());
                }
            }).start();
        }
    }
}
