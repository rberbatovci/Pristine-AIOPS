import React from 'react';
import { FaRegUserCircle } from "react-icons/fa";
import '../css/Header.css';
import { NavLink } from 'react-router-dom';

const Header = ({ currentUser }) => {
  return (
    <div>
      <div className="header-container">
        <div className="header">
          <p className="headerTitle">Fault Management Dashboard</p>
        </div>
        <div className="misc">
          <p>Hello, {currentUser.username}</p>
          <NavLink to="/profile" className="userIcon">
            <FaRegUserCircle />
          </NavLink>
        </div>
      </div>
    </div>
  );
};

export default Header;
