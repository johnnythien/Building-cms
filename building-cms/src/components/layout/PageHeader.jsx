import React from 'react';
import { Link } from 'react-router-dom';
import './PageHeader.css';

/**
 * PageHeader component for consistent headers across all category screens
 * @param {Object} props
 * @param {string} props.title - The title of the page
 * @param {string} props.buttonText - Text for the primary action button
 * @param {function} props.onButtonClick - Function to handle button click
 * @param {string} props.buttonLink - Optional link for the button (use either onClick or link)
 * @param {boolean} props.hideButton - Whether to hide the action button
 * @param {string} props.buttonClassName - Optional additional class name for the button
 */
const PageHeader = ({ 
  title, 
  buttonText = "Tạo mới", 
  onButtonClick, 
  buttonLink, 
  hideButton = false,
  buttonClassName = ""
}) => {
  return (
    <div className="page-header">
      <h2 className="page-title">{title}</h2>
      
      {!hideButton && (
        buttonLink ? (
          <Link 
            to={buttonLink} 
            className={`btn page-header-btn ${buttonClassName}`}
          >
            {buttonText}
          </Link>
        ) : (
          <button 
            className={`btn page-header-btn ${buttonClassName}`}
            onClick={onButtonClick}
          >
            {buttonText}
          </button>
        )
      )}
    </div>
  );
};

export default PageHeader; 