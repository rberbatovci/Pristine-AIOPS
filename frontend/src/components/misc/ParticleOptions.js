import lightBackground from '../../images/lightBackground.jpg';
import darkBackground from '../../images/darkBackground.jpg'; // If you have a dark theme background image

export const lightThemeOptions = {
    background: {
        color: "#ffffff",
        image: `url(${lightBackground})`, // Use the imported image
        position: "50% 50%",
        repeat: "no-repeat",
        size: "cover"
    },
    particles: {
        color: {
            value: "#000000",
        },
        links: {
            color: "#000000",
            distance: 150,
            enable: true,
            opacity: 0.5,
            width: 1,
        },
        move: {
            enable: true,
            speed: 2,
        },
        number: {
            value: 80,
        },
        shape: {
            type: "circle",
        },
        size: {
            value: { min: 1, max: 5 },
        },
    },
};

export const darkThemeOptions = {
    background: {
        color: "#0a1c23",
        image: "none",
        position: "50% 50%",
        repeat: "no-repeat",
        size: "cover",
        gradient: "red",
    },
    particles: {
        number: {
            value: 100,
            density: {
                enable: true,
                value_area: 800,
            },
        },
        color: {
            value: "#c0e6f2", // Retained your particle color
        },
        shape: {
            type: "circle",
            stroke: {
                width: 0,
                color: "#000000",
            },
            polygon: {
                nb_sides: 5,
            },
        },
        opacity: {
            value: 0.5,
            random: false,
            anim: {
                enable: false,
                speed: 1,
                opacity_min: 0.1,
                sync: false,
            },
        },
        size: {
            value: 3,
            random: true,
            anim: {
                enable: false,
                speed: 40,
                size_min: 0.1,
                sync: false,
            },
        },
        links: {
            color: "#34bef5", // Retained your link color
            distance: 150,
            enable: true,
            opacity: 0.4,
            width: 1,
        },
        move: {
            enable: true,
            speed: 2,
            direction: "none",
            random: false,
            straight: false,
            out_mode: "out",
            bounce: false,
            attract: {
                enable: false,
                rotateX: 600,
                rotateY: 1200,
            },
        },
    },
    interactivity: {
        detect_on: "canvas",
        events: {
            onhover: {
                enable: true,
                mode: "repulse",
            },
            onclick: {
                enable: true,
                mode: "push",
            },
            resize: true,
        },
        modes: {
            grab: {
                distance: 400,
                line_linked: {
                    opacity: 1,
                },
            },
            bubble: {
                distance: 400,
                size: 40,
                duration: 2,
                opacity: 8,
                speed: 3,
            },
            repulse: {
                distance: 200,
                duration: 0.4,
            },
            push: {
                particles_nb: 4,
            },
            remove: {
                particles_nb: 2,
            },
        },
    },
    retina_detect: true,
};
