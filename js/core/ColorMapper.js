export class ColorMapper {
  static stops = [
    { t: 0, color: [12, 35, 72] },
    { t: 0.24, color: [34, 109, 175] },
    { t: 0.48, color: [54, 173, 195] },
    { t: 0.7, color: [91, 179, 126] },
    { t: 1, color: [241, 201, 95] },
  ];

  static normalize(value, min, max) {
    if (max === min) {
      return 0.5;
    }

    return Math.min(1, Math.max(0, (value - min) / (max - min)));
  }

  static interpolateColor(t) {
    const clamped = Math.min(1, Math.max(0, t));

    for (let index = 0; index < ColorMapper.stops.length - 1; index += 1) {
      const current = ColorMapper.stops[index];
      const next = ColorMapper.stops[index + 1];

      if (clamped >= current.t && clamped <= next.t) {
        const localT = (clamped - current.t) / (next.t - current.t);
        const channels = current.color.map((channel, channelIndex) =>
          Math.round(channel + (next.color[channelIndex] - channel) * localT),
        );

        return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
      }
    }

    const fallback = ColorMapper.stops[ColorMapper.stops.length - 1].color;
    return `rgb(${fallback[0]}, ${fallback[1]}, ${fallback[2]})`;
  }

  static colorForElevation(value, min, max) {
    return ColorMapper.interpolateColor(ColorMapper.normalize(value, min, max));
  }

  static toCSSGradient() {
    const segments = [...ColorMapper.stops].reverse().map((stop) => {
      const [red, green, blue] = stop.color;
      return `rgb(${red}, ${green}, ${blue}) ${Math.round((1 - stop.t) * 100)}%`;
    });

    return `linear-gradient(180deg, ${segments.join(", ")})`;
  }
}

export default ColorMapper;
