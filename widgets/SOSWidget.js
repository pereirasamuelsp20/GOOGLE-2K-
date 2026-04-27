// widgets/SOSWidget.js
// Android Home Screen Widget — Single red SOS button.
// Tapping triggers a general SOS without login.
// Only FlexWidget, TextWidget, ImageWidget, ListWidget are available.
// NO hooks, NO state, NO async. Pure declarative render.
// IMPORTANT: Android widgets do NOT support rgba() colors — use hex only.

import React from 'react';
import {
  FlexWidget,
  TextWidget,
} from 'react-native-android-widget';

/**
 * Android Home Screen Widget for ReliefMesh SOS
 *
 * @param {Object} props
 * @param {boolean} props.sosActive - Whether an SOS is currently dispatched
 * @param {string} props.activeType - 'fire' | 'medical' | 'security' | 'general' | null
 */
export function SOSWidget({ sosActive, activeType }) {
  // Normalize props — widget rendering can pass undefined
  const isActive = sosActive === true;
  const type = activeType || 'emergency';

  if (isActive) {
    // ACTIVE STATE — red alert banner
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#3A0000',
          borderRadius: 20,
          padding: 16,
        }}
        clickAction="OPEN_APP"
      >
        <TextWidget
          text="SOS ACTIVE"
          style={{
            fontSize: 18,
            fontFamily: 'sans-serif-black',
            color: '#FF3B30',
            textAlign: 'center',
          }}
        />
        <TextWidget
          text={type.toUpperCase()}
          style={{
            fontSize: 12,
            fontFamily: 'sans-serif',
            color: '#FF9A94',
            textAlign: 'center',
            marginTop: 4,
            letterSpacing: 3,
          }}
        />
        <TextWidget
          text="TAP TO TRACK STATUS"
          style={{
            fontSize: 10,
            color: '#6A2222',
            textAlign: 'center',
            marginTop: 8,
            letterSpacing: 2,
          }}
        />
      </FlexWidget>
    );
  }

  // DEFAULT STATE — Large red SOS button with concentric ring design
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0A0A0A',
        borderRadius: 20,
        padding: 8,
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'reliefmesh://sos?type=general' }}
    >
      {/* Outer ring — use solid hex, no rgba */}
      <FlexWidget
        style={{
          width: 110,
          height: 110,
          borderRadius: 55,
          borderWidth: 2,
          borderColor: '#1F0808',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#0A0A0A',
        }}
      >
        {/* Inner ring */}
        <FlexWidget
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            borderWidth: 2,
            borderColor: '#2E0F0F',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#0A0A0A',
          }}
        >
          {/* Red SOS Button */}
          <FlexWidget
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: '#FF3B30',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <TextWidget
              text="SOS"
              style={{
                fontSize: 18,
                fontFamily: 'sans-serif-black',
                color: '#FFFFFF',
                textAlign: 'center',
                letterSpacing: 2,
              }}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {/* Label under rings */}
      <TextWidget
        text="TAP FOR EMERGENCY"
        style={{
          fontSize: 8,
          color: '#444444',
          textAlign: 'center',
          marginTop: 6,
          letterSpacing: 2,
        }}
      />
    </FlexWidget>
  );
}
