const customStyles = ( width ) => ({
    control: (baseStyles, { isMulti, hasValue }) => ({
      ...baseStyles,
      border: 'var(--borderDark)',
      borderRadius: '8px',
      width: width,
      minHeight: '40px',
      maxHeight: isMulti && hasValue ? 'auto' : '40px',
      background: 'var(--buttonBackground)',
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: 'var(--textColor)',
      overflow: 'visible',
      '&:hover': {
        border: 'var(--borderDarkHvr)',
      },
    }),
    placeholder: (provided) => ({
      ...provided,
      color: 'var(--textColor)',
      fontSize: '13px',
      opacity: 0.7,
      fontFamily: 'Arial, sans-serif',
    }),
    valueContainer: (baseStyles) => ({
      ...baseStyles,
      fontSize: '13px',
      fontFamily: 'Arial, sans-serif',
      padding: '4px 8px',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '4px',
    }),
    option: (provided) => ({
      ...provided,
      borderTop: 'var(--border-color2)',
      borderBottom: 'var(--border-color3)',
      transition: '.5s',
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: 'var(--textColor)',
      '&:hover': {
        background: 'var(--inputTextBck)',
      },
    }),
    multiValue: (baseStyles) => ({
      ...baseStyles,
      background: 'var(--contentBackground)',
      padding: '4px',
      borderRadius: '5px',
      transition: '.5s',
      boxShadow: '1px 2px 3px rgba(0, 3, 3, .2)',
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      color: 'var(--textColor)',
      '&:hover': {
        color: 'var(--textColor2)',
        background: 'var(--hoverBackground)',
      },
    }),
    multiValueLabel: (baseStyles) => ({
      ...baseStyles,
      color: 'var(--text-color2)',
      paddingLeft: '8px',
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
    }),
    menu: (baseStyles) => ({
      ...baseStyles,
      background: 'var(--backgroundColor)',
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: 'var(--textColor)',
    }),
    menuList: (baseStyles) => ({
      ...baseStyles,
      maxHeight: '200px',
      overflowY: 'auto',
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: 'var(--textColor)',
    }),
    singleValue: (baseStyles) => ({
      ...baseStyles,
      color: 'var(--selectedOptionColor)',  // Customize this color for the selected option
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
    }),
  });
  
  export default customStyles;
  