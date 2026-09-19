// The things the launcher launches, in default order. Every era reads this
// one list; v1 uses the icon and href, v2 also shows the blurb, media and
// links in its detail view. Drop a raw rectangular image into assets/raw/
// and add an entry (see README, "Icons").

import heatmapIcon from './assets/raw/heatmap.png';
import eastselfIcon from './assets/raw/eastself.jpg';
import okdamIcon from './assets/raw/okdam.png';
import coverseIcon from './assets/raw/coverse-icon.png';
import awaIcon from './assets/raw/awa.png';
import censorIcon from './assets/raw/censor.png';
import photopeaceIcon from './assets/raw/photopeace.png';
import gswIcon from './assets/raw/gsw.png';
import artmuIcon from './assets/raw/artmu.png';
import artmuDarkIcon from './assets/raw/artmu-dark.png';
import chatIcon from './assets/raw/chat.png';
import chatLightIcon from './assets/raw/chat-light.png';
import setupIcon from './assets/raw/setup.png';
import dashIcon from './assets/raw/dash.png';
import githubIcon from './assets/raw/github-mark.svg';
import markfopsIcon from './assets/raw/markfops.png';
import awareIcon from './assets/raw/aware.png';

export type Entry = {
  name: string;
  href: string;
  icon: string;
  /** shown instead of `icon` in dark mode */
  darkIcon?: string;
  /**
   * How the artwork is treated inside the standard macOS icon canvas.
   * - cover:     raw rectangular image; pipeline crops and rounds it
   * - preshaped: artwork is already a finished macOS icon; passed through
   * - tile:      glyph on a colored rounded tile (github style)
   * Geometry (inset, radius, shadow) is owned by the pipeline and can never
   * vary per icon — only the treatment of its content.
   */
  treatment?: 'cover' | 'preshaped' | 'tile';
  /** a sentence or three for the v2 detail view */
  about?: string;
  /** a demo picture or clip for the v2 detail view; paths under public/ */
  media?: { kind: 'image' | 'video'; src: string; alt?: string };
  /** extra links in the v2 detail view; `href` itself is always first */
  links?: { label: string; href: string }[];
};

export const ENTRIES: Entry[] = [
  {
    name: 'github',
    href: 'https://github.com/LPFchan',
    icon: githubIcon,
    treatment: 'tile',
    about: 'Everything here starts as a repo. The public ones live on my GitHub.',
  },
  {
    name: 'heatmap',
    href: 'https://heatmap.lost.plus',
    icon: heatmapIcon,
    treatment: 'preshaped',
    about:
      'A self-hosted calendar of coding-agent sessions across every machine I own. Each day is a heat cell, each session a recap that writes itself.',
  },
  {
    name: 'okdam',
    href: 'https://okdam.lost.plus',
    icon: okdamIcon,
    about:
      'Songbook: a personal karaoke repertoire as a PWA. TJ numbers, Japanese readings, performance history, and an offline queue for the booth.',
  },
  {
    name: 'coverse',
    href: 'https://coverse.lost.plus',
    icon: coverseIcon,
    about:
      'A shared browser workspace for writing lyrics against audio stems and MIDI melodies. Timing edits and track layouts sync between collaborators.',
  },
  {
    name: 'awa',
    href: 'https://awa.lost.plus',
    icon: awaIcon,
    about:
      'Private live chatrooms where coding agents can talk directly through a shared timeline while humans quietly follow along.',
  },
  {
    name: 'censor',
    href: 'https://censor.lost.plus',
    icon: censorIcon,
    about:
      'A mobile PWA that censors photos with nondestructive blur and mosaic objects. Everything runs on the device; nothing is uploaded.',
    links: [{ label: 'source', href: 'https://github.com/LPFchan/censor' }],
  },
  {
    name: 'photopeace',
    href: 'https://photopeace.lost.plus',
    icon: photopeaceIcon,
    about: 'Photo tooling. Blurb pending.',
  },
  {
    name: 'gsw',
    href: 'https://gsw.lost.plus',
    icon: gswIcon,
    about:
      'Private tooling for archiving Hyundai and Kia Global Service Way manuals offline, and for letting agents read them.',
  },
  {
    name: 'setup',
    href: 'https://setup.lost.plus',
    icon: setupIcon,
    about:
      'Curl-installable setup for every Linux and macOS machine I use. Dotfiles, agent rules, skills and services, synced across the fleet nightly.',
    links: [{ label: 'source', href: 'https://github.com/LPFchan/setup' }],
  },
  {
    name: 'dash',
    href: 'https://dash.lost.plus',
    icon: dashIcon,
    treatment: 'preshaped',
    about: 'Usage and telemetry dashboard for the inference gateway behind chat.',
    links: [{ label: 'source', href: 'https://github.com/LPFchan/inference' }],
  },
  {
    name: 'chat',
    href: 'https://chat.lost.plus',
    icon: chatIcon,
    darkIcon: chatLightIcon,
    about:
      'An OpenAI-compatible gateway in front of self-hosted models: llama.cpp on one GPU box, vLLM on another, one endpoint for all of them.',
    links: [{ label: 'source', href: 'https://github.com/LPFchan/inference' }],
  },
  {
    name: 'markfops',
    href: 'https://github.com/LPFchan/Markfops',
    icon: markfopsIcon,
    treatment: 'preshaped',
    about: 'A lightweight native macOS Markdown editor written in Swift.',
  },
  {
    name: 'aware',
    href: 'https://github.com/LPFchan/Aware',
    icon: awareIcon,
    treatment: 'preshaped',
    about:
      'A macOS menu bar app that keeps your Mac awake by noticing you are still there, through the FaceTime camera.',
  },
  {
    name: 'artmu',
    href: 'https://artmu.lost.plus',
    icon: artmuIcon,
    darkIcon: artmuDarkIcon,
    about:
      'The website and CLI for artmu-bench, a multimodal LLM benchmark about reading pictures the way people do.',
  },
  {
    name: 'eastself',
    href: 'https://eastself.lost.plus',
    icon: eastselfIcon,
    about:
      'A Telegram persona bot: an open model fine-tuned on my own messages and grounded by a memory store. "i always wanted to have a twin."',
  },
];
