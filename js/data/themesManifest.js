// js/data/themesManifest.js
/**
 * @file Stores the THEMES_MANIFEST array, listing available themes, their paths,
 * and playability status. This data is used by themeService.js.
 */

export const THEMES_MANIFEST = [
    {
        id: "grim_warden",
        path: "themes/grim_warden/", // Relative path from the project root where themes are stored
        playable: true,
    },
    {
        id: "celestial_custodians", // Example of another theme
        path: "themes/celestial_custodians/",
        playable: true, // Assuming it's playable; adjust as needed
    },
    {
        id: "echo_sleuths",
        path: "themes/echo_sleuths/",
        playable: true,
    },
    {
        id: "salt_reavers", // Example of another theme
        path: "themes/salt_reavers/",
        playable: true, // Assuming it's playable
    },
    // { // Example of an unplayable/upcoming theme
    //     id: "quantum_dreamers",
    //     path: "themes/quantum_dreamers/",
    //     playable: false,
    // },
    { // Master theme entry, if it has its own specific files not covered by others (e.g., master prompts)
        id: "master",
        path: "themes/master/", // Path to master-specific files like master prompts
        playable: false, // Master theme itself is not directly "played" as a scenario
    }
];
