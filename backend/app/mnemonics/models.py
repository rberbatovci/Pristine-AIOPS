class Mnemonic(Base):
    __tablename__ = 'mnemonics'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(30), unique=True, index=True)
    level = Column(Integer, nullable=True, default=None)
    severity = Column(String(15), nullable=True, default=None)
    alert = Column(Boolean, default=False)
    
    regexes = relationship('RegEx', secondary='mnemonic_regex', backref='mnemonics')
    rules = relationship(
        'StatefulSyslogRule',
        secondary=mnemonic_rules_association,
        back_populates='mnemonics'
    )

    def __str__(self):
        return self.name