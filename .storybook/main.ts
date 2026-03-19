import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  stories: ["../sidebar/**/*.stories.@(ts|tsx)"],
  typescript: {
    check: false,
    reactDocgen: "react-docgen",
  },
};

export default config;
