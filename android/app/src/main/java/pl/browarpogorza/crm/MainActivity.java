package pl.browarpogorza.crm;

import android.graphics.Color;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Capacitor's SystemBars plugin already passes the system-bar insets through to the page
 * (the app pads its headers with env(safe-area-inset-*)). Only the window background is set
 * here, so the strip behind the status bar and the gesture bar matches the dark app chrome.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().getDecorView().setBackgroundColor(Color.parseColor("#0F1218"));
        getBridge().getWebView().setBackgroundColor(Color.parseColor("#0F1218"));
    }
}
