// widgets/SOSWidget.js
// Android Home Screen Widget — Single red SOS button.
// Tapping triggers a general SOS without login.
// Only FlexWidget, TextWidget, ImageWidget, ListWidget are available.
// NO hooks, NO state, NO async. Pure declarative render.

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
export function SOSWidget({ sosActive = false, activeType = null }) {
  if (sosActive) {
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
        }}
        clickAction="OPEN_APP"
      >
        <TextWidget
          text="🚨 SOS ACTIVE"
          style={{
            fontSize: 18,
            fontFamily: 'sans-serif-black',
            color: '#FF3B30',
            textAlign: 'center',
          }}
        />
        <TextWidget
          text={activeType ? activeType.toUpperCase() : 'EMERGENCY'}
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
          text="TAP TO TRACK STATUS →"
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

  // DEFAULT STATE — Large red SOS button with glow rings matching iOS precisely
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
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'reliefmesh://sos?type=general' }}
    >
      {/* Outer ring */}
      <FlexWidget
        style={{
          width: 110,
          height: 110,
          borderRadius: 55,
          borderWidth: 2,
          borderColor: 'rgba(255, 59, 48, 0.12)',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#00000000',
        }}
      >
        {/* Inner ring */}
        <FlexWidget
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            borderWidth: 2,
            borderColor: 'rgba(255, 59, 48, 0.18)',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#00000000',
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
    </FlexWidget>
  );
}
