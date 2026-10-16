import React from 'react';
import styled from 'styled-components';

const PrimaryButton = ({
  children,
  onClick,
  type = 'button',
  disabled = false,
  className,
  ...rest
}) => (
  <StyledButton
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={className}
    {...rest}
  >
    <span className="text">{children}</span>
  </StyledButton>
);

const StyledButton = styled.button`
  align-items: center;
  background-image: linear-gradient(144deg, #af40ff, #5b42f3 50%, #00ddeb);
  border: 0;
  border-radius: 8px;
  box-shadow: rgba(151, 65, 252, 0.2) 0 15px 30px -5px;
  box-sizing: border-box;
  color: var(--btn-text-color, #ffffff);
  display: inline-flex;
  font-size: 14px;
  font-weight: 600;
  justify-content: center;
  line-height: 1em;
  max-width: 100%;
  padding: 2px;
  user-select: none;
  touch-action: manipulation;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.3s;

  .text {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background-color: var(--btn-inner-bg, rgb(5, 6, 45));
    color: var(--btn-text-color, #ffffff);
    padding: 10px 18px;
    border-radius: 6px;
    width: 100%;
    transition: 300ms;
  }

  &:hover .text {
    background: none;
    color: #ffffff;
  }

  &:active {
    transform: scale(0.97);
  }

  &:focus-visible {
    outline: 2px solid #00ddeb;
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
  &:disabled:hover .text {
    background-color: var(--btn-inner-bg, rgb(5, 6, 45));
    color: var(--btn-text-color, #ffffff);
  }
`;

export { PrimaryButton };
export default PrimaryButton;
