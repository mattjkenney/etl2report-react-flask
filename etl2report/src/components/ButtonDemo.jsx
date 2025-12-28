import React from 'react';
import Button from './Button';
import ThemeToggle from './ThemeToggle';

const ButtonDemo = () => {
  return (
    <div className="p-8 space-y-6 bg-theme-primary">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-theme-primary mb-4">Button Component Demo</h2>
        <ThemeToggle />
      </div>
      
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-theme-primary mb-2">Primary Button</h3>
          <p className="text-theme-secondary text-sm mb-2">Hover to see white inner border + blue-400 outer border</p>
          <Button 
            displayText="Primary Button" 
            variant="primary" 
            onClick={() => console.log('Primary clicked')}
          />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-theme-primary mb-2">Danger Button</h3>
          <p className="text-theme-secondary text-sm mb-2">Hover to see white inner border + red-400 outer border</p>
          <Button 
            displayText="Danger Button" 
            variant="danger" 
            onClick={() => console.log('Danger clicked')}
          />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-theme-primary mb-2">Secondary Button</h3>
          <p className="text-theme-secondary text-sm mb-2">Hover to see white inner border + blue-400 outer border</p>
          <Button 
            displayText="Secondary Button" 
            variant="secondary" 
            onClick={() => console.log('Secondary clicked')}
          />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-theme-primary mb-2">Ghost Button</h3>
          <p className="text-theme-secondary text-sm mb-2">Appears as plain text until hovered - text changes to blue-400 on hover. Use for buttons that should be invisible until interaction.</p>
          <Button 
            displayText="Ghost Button" 
            variant="ghost" 
            onClick={() => console.log('Ghost clicked')}
          />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-theme-primary mb-2">Different Sizes</h3>
          <div className="flex gap-4 items-end">
            <Button displayText="Small" variant="primary" size="small" />
            <Button displayText="Medium" variant="primary" size="medium" />
            <Button displayText="Large" variant="primary" size="large" />
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-theme-primary mb-2">Ghost Button Variants by Size</h3>
          <p className="text-theme-secondary text-sm mb-2">Ghost buttons at different sizes - all appear as plain text until hovered</p>
          <div className="flex gap-4 items-end">
            <Button displayText="Small Ghost" variant="ghost" size="small" />
            <Button displayText="Medium Ghost" variant="ghost" size="medium" />
            <Button displayText="Large Ghost" variant="ghost" size="large" />
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-theme-primary mb-2">Loading State</h3>
          <Button displayText="Loading..." variant="primary" loading={true} />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-theme-primary mb-2">Disabled State</h3>
          <div className="flex gap-4 items-center">
            <Button displayText="Disabled Primary" variant="primary" disabled={true} />
            <Button displayText="Disabled Ghost" variant="ghost" disabled={true} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ButtonDemo;