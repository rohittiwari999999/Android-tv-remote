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
        registerPlugin(NsdDiscoveryPlugin.class);
        super.onCreate(savedInstanceState);
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebSettings settings = getBridge().getWebView().getSettings();
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }
        } catch (Exception ignored) {
        }
    }

    @CapacitorPlugin(name = "NsdDiscoveryPlugin")
    public static class NsdDiscoveryPlugin extends Plugin {
        @PluginMethod
        public void discoverDevices(PluginCall call) {
            new Thread(() -> {
                try {
                    android.net.nsd.NsdManager manager = (android.net.nsd.NsdManager) getContext().getSystemService(android.content.Context.NSD_SERVICE);
                    com.getcapacitor.JSArray devices = new com.getcapacitor.JSArray();
                    java.util.Set<String> seenIps = new java.util.HashSet<>();

                    android.net.nsd.NsdManager.DiscoveryListener listener = new android.net.nsd.NsdManager.DiscoveryListener() {
                        @Override
                        public void onDiscoveryStarted(String regType) {}

                        @Override
                        public void onServiceFound(android.net.nsd.NsdServiceInfo service) {
                            try {
                                manager.resolveService(service, new android.net.nsd.NsdManager.ResolveListener() {
                                    @Override
                                    public void onResolveFailed(android.net.nsd.NsdServiceInfo serviceInfo, int errorCode) {}

                                    @Override
                                    public void onServiceResolved(android.net.nsd.NsdServiceInfo serviceInfo) {
                                        try {
                                            String host = serviceInfo.getHost().getHostAddress();
                                            String name = serviceInfo.getServiceName();
                                            int port = serviceInfo.getPort();
                                            if (host != null && !seenIps.contains(host)) {
                                                seenIps.add(host);
                                                com.getcapacitor.JSObject obj = new com.getcapacitor.JSObject();
                                                obj.put("name", name);
                                                obj.put("ip", host);
                                                obj.put("port", port);
                                                devices.put(obj);
                                            }
                                        } catch (Exception ignored) {}
                                    }
                                });
                            } catch (Exception ignored) {}
                        }

                        @Override
                        public void onServiceLost(android.net.nsd.NsdServiceInfo service) {}
                        @Override
                        public void onDiscoveryStopped(String serviceType) {}
                        @Override
                        public void onStartDiscoveryFailed(String serviceType, int errorCode) {}
                        @Override
                        public void onStopDiscoveryFailed(String serviceType, int errorCode) {}
                    };

                    manager.discoverServices("_googlecast._tcp", android.net.nsd.NsdManager.PROTOCOL_DNS_SD, listener);
                    // Wait 2.2 seconds to collect mDNS responses
                    Thread.sleep(2200);
                    try {
                        manager.stopServiceDiscovery(listener);
                    } catch (Exception ignored) {}

                    com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                    ret.put("devices", devices);
                    call.resolve(ret);
                } catch (Exception e) {
                    com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                    ret.put("devices", new com.getcapacitor.JSArray());
                    call.resolve(ret);
                }
            }).start();
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
