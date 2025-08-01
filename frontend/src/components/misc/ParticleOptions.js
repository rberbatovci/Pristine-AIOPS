import lightBackground from '../../images/lightBackground.jpg';
import darkBackground from '../../images/darkBackground.jpg'; // If you have a dark theme background image

export const lightThemeOptions = {
    background: {
        color: "#e2e2e2ff",
        image: `url(${lightBackground})`,
        position: "50% 50%",
        repeat: "no-repeat",
        size: "cover"
    },
    particles: {
        number: {
            value: 150
        },
        groups: {
            gray: {
                number: {
                    value: 106 // 80%
                },
                color: {
                    value: "#eeeeeeff"
                }
            },
            blue: {
                number: {
                    value: 22 // 10%
                },
                color: {
                    value: "#22508b"
                }
            },
            pink: {
                number: {
                    value: 22 // 10%
                },
                color: {
                    value: "#ff69b4"
                }
            }
        },
        shape: {
            type: "circle"
        },
        size: {
            value: { min: 1, max: 3 }
        },
        move: {
            enable: true,
            speed: 2
        },
        links: {
            color: "#fefeffff",
            distance: 150,
            enable: true,
            opacity: 0.3,
            width: 0.5
        }
    },
    interactivity: {
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
    }
};

export const darkThemeOptions = {
    background: {
        color: "#0a1c23",
        position: "50% 50%",
        repeat: "no-repeat",
        size: "cover"
    },
    particles: {
        number: {
            value: 150
        },
        groups: {
            gray: {
                number: {
                    value: 106 // 80%
                },
                color: {
                    value: "#0f6985ff"
                }
            },
            blue: {
                number: {
                    value: 22 // 10%
                },
                color: {
                    value: "#22508b"
                }
            },
            pink: {
                number: {
                    value: 22 // 10%
                },
                color: {
                    value: "#ff69b4"
                }
            }
        },
        shape: {
            type: "circle"
        },
        size: {
            value: { min: 1, max: 3 }
        },
        move: {
            enable: true,
            speed: 2
        },
        links: {
            color: "#0f6985ff",
            distance: 150,
            enable: true,
            opacity: 0.3,
            width: 0.5
        }
    },
    interactivity: {
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
    }
};
