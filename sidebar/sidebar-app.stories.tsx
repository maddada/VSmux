import type { Meta, StoryObj } from "@storybook/react-vite";
import { SidebarStoryHarness } from "./sidebar-story-harness";
import { createSidebarStoryMessage, type SidebarStoryArgs } from "./sidebar-story-fixtures";

const meta = {
  title: "Sidebar/App",
  args: {
    fixture: "default",
    highlightedVisibleCount: 1,
    isFocusModeActive: false,
    showCloseButtonOnSessionCards: false,
    showHotkeysOnSessionCards: false,
    theme: "dark-blue",
    viewMode: "grid",
    visibleCount: 1,
  },
  argTypes: {
    fixture: {
      control: "select",
      options: ["default", "selector-states", "overflow-stress", "empty-groups"],
    },
    highlightedVisibleCount: {
      control: "inline-radio",
      options: [1, 2, 3, 4, 6, 9],
    },
    isFocusModeActive: {
      control: "boolean",
    },
    showCloseButtonOnSessionCards: {
      control: "boolean",
    },
    showHotkeysOnSessionCards: {
      control: "boolean",
    },
    theme: {
      control: "select",
      options: [
        "plain-dark",
        "plain-light",
        "dark-green",
        "dark-blue",
        "dark-red",
        "dark-pink",
        "dark-orange",
        "light-blue",
        "light-green",
        "light-pink",
        "light-orange",
      ],
    },
    viewMode: {
      control: "inline-radio",
      options: ["horizontal", "vertical", "grid"],
    },
    visibleCount: {
      control: "inline-radio",
      options: [1, 2, 3, 4, 6, 9],
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          display: "grid",
          justifyItems: "center",
          minHeight: "100vh",
          padding: "16px",
        }}
      >
        <div
          style={{
            height: "950px",
            overflow: "auto",
            width: "300px",
          }}
        >
          <Story />
        </div>
      </div>
    ),
  ],
  render: (args) => <SidebarStoryHarness message={createSidebarStoryMessage(args)} />,
} satisfies Meta<SidebarStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SelectorStates: Story = {
  args: {
    fixture: "selector-states",
    highlightedVisibleCount: 4,
    isFocusModeActive: true,
    showCloseButtonOnSessionCards: true,
    showHotkeysOnSessionCards: true,
    theme: "dark-green",
    viewMode: "vertical",
    visibleCount: 1,
  },
};

export const OverflowStress: Story = {
  args: {
    fixture: "overflow-stress",
    highlightedVisibleCount: 6,
    showCloseButtonOnSessionCards: true,
    showHotkeysOnSessionCards: true,
    theme: "light-orange",
    viewMode: "grid",
    visibleCount: 6,
  },
};

export const EmptyGroups: Story = {
  args: {
    fixture: "empty-groups",
    highlightedVisibleCount: 1,
    showCloseButtonOnSessionCards: false,
    showHotkeysOnSessionCards: false,
    theme: "dark-blue",
    viewMode: "horizontal",
    visibleCount: 1,
  },
};
