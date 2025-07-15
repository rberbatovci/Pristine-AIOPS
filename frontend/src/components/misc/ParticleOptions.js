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
            value: "#22508bff",
        },
        links: {
            color: "#7996bdff",
            distance: 150,
            enable: true,
            opacity: 0.3,
            width: .5,
        },
        move: {
            enable: true,
            speed: 2,
        },
        number: {
            value: 120,
        },
        shape: {
            type: "circle",
        },
        size: {
            value: { min: 1, max: 5 },
        },
    },
    interactivity: {
        detectsOn: "canvas",
        events: {
            onHover: {
                enable: true,
                mode: "repulse"
            },
            onClick: {
                enable: true,
                mode: "push"
            },
            resize: true
        },
        modes: {
            repulse: {
                distance: 100,
                duration: 0.4
            },
            push: {
                quantity: 4
            },
            grab: {
                distance: 200,
                links: {
                    opacity: 0.5
                }
            },
            bubble: {
                distance: 250,
                size: 4,
                duration: 2,
                opacity: 0.8
            },
            remove: {
                quantity: 2
            }
        }
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
            value: 120,
            density: {
                enable: true,
                value_area: 1200,
            },
        },
        color: {
            value: "#49a1d8ff",
        },
        shape: {
            type: "circle",
            stroke: {
                width: 0,
                color: "#247bc2ff",
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
            value: { min: 1, max: 5 },
        },
        links: {
            color: "#7ea7c0ff",
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
        detectsOn: "canvas",
        events: {
            onHover: {
                enable: true,
                mode: "repulse"
            },
            onClick: {
                enable: true,
                mode: "push"
            },
            resize: true
        },
        modes: {
            repulse: {
                distance: 100,
                duration: 0.4
            },
            push: {
                quantity: 4
            },
            grab: {
                distance: 200,
                links: {
                    opacity: 0.5
                }
            },
            bubble: {
                distance: 250,
                size: 4,
                duration: 2,
                opacity: 0.8
            },
            remove: {
                quantity: 2
            }
        }
    },
    retina_detect: true,
};
