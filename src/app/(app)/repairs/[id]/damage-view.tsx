'use client';

import { DamageMarker, type DamageMark } from '@/components/damage-marker';
import type { DeviceType } from '@/lib/constants';

/** عرض مواضع الأضرار للقراءة فقط */
export function DamageMarkerView({
  deviceType,
  marks,
  label,
}: {
  deviceType: DeviceType;
  marks: DamageMark[];
  label: string;
}) {
  return (
    <DamageMarker
      deviceType={deviceType}
      marks={marks}
      onChange={() => {}}
      label={label}
      readOnly
    />
  );
}
