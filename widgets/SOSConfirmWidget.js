// widgets/SOSConfirmWidget.js
// Confirmation overlay shown before dispatching SOS from widget.
// User must tap CONFIRM to send, or CANCEL to abort.
// This prevents accidental SOS triggers from the home screen.
// IMPORTANT: Android widgets do NOT support rgba() or gap — use hex and margins.

import React from 'react';
import {
  FlexWidget,
  TextWidget,
} from 'react-native-android-widget';

const TYPE_COLORS = {
  fire: { bg: '#1A0A00', border: '#FF6B35', text: '#FF6B35' },
  medical: { bg: '#001A0F', border: '#00CC66', text: '#00CC66' },
  security: { bg: '#0A0A1A', border: '#4488FF', text: '#4488FF' },
};

/**
 * @param {Object} props
 * @param {string} props.pendingType - 'fire' | 'medical' | 'security'
 */
export function SOSConfirmWidget({ pendingType }) {
  const type = pendingType || 'fire';
  const colors = TYPE_COLORS[type] || TYPE_COLORS.fire;
  const typeUpper = type.toUpperCase();

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: '#0F0F0F',
        borderRadius: 20,
        padding: 12,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Warning header */}
      <TextWidget
        text={`SEND ${typeUpper} SOS?`}
        style={{
          fontSize: 14,
          fontFamily: 'sans-serif-black',
          color: colors.text,
          textAlign: 'center',
          letterSpacing: 1,
        }}
      />

      <TextWidget
        text="This will alert emergency responders"
        style={{
          fontSize: 10,
          color: '#666666',
          textAlign: 'center',
          marginTop: 6,
          marginBottom: 12,
        }}
      />

      {/* Action buttons row — use margins instead of gap */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          width: 'match_parent',
        }}
      >
        {/* CONFIRM button */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: colors.bg,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: colors.border,
            padding: 10,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 6,
          }}
          clickAction={`CONFIRM_SOS_${typeUpper}`}
        >
          <TextWidget
            text="CONFIRM"
            style={{
              fontSize: 11,
              fontFamily: 'sans-serif-black',
              color: colors.text,
              textAlign: 'center',
              letterSpacing: 1,
            }}
          />
        </FlexWidget>

        {/* CANCEL button */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: '#1A1A1A',
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#333333',
            padding: 10,
            justifyContent: 'center',
            alignItems: 'center',
            marginLeft: 6,
          }}
          clickAction="CANCEL_SOS"
        >
          <TextWidget
            text="CANCEL"
            style={{
              fontSize: 11,
              fontFamily: 'sans-serif-black',
              color: '#888888',
              textAlign: 'center',
              letterSpacing: 1,
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
