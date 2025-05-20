import os
import logging.config

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) 

LOGGING_CONFIG = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'default': {
            'format': '%(levelname)s %(asctime)s %(module)s %(process)d %(thread)d %(message)s'
        },
    },
    'handlers': {
        'incidentsLogFile': {
            'level': 'DEBUG',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'logs/incidents.log'),
            'formatter': 'default',
        },
        'syslogsLogFile': {
            'level': 'DEBUG',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'logs/syslogs.log'),
            'formatter': 'default',
        },
        'signalsLogFile': {
            'level': 'DEBUG',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'logs/signals.log'),
            'formatter': 'default',
        },
        'snmpTrapLogFile': {
            'level': 'DEBUG',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'logs/snmptraps.log'),
            'formatter': 'default'
        },
    },
    'loggers': {
        'incidentsLogger': {
            'handlers': ['incidentsLogFile'],
            'level': 'DEBUG',
            'propagate': True,
        },
        'syslogLogger': {
            'handlers': ['syslogsLogFile'],
            'level': 'DEBUG',
            'propagate': True,
        },
        'signalLogger': {
            'handlers': ['signalsLogFile'],
            'level': 'DEBUG',
            'propagate': True,
        },
        'snmpTrapLogger': {
            'handlers': ['snmpTrapLogFile'],
            'level': 'DEBUG',
            'propagate': True,
        },
    },
}
