import { motion } from 'framer-motion';

export default function IgnoredIndicator({ show }) {
    if (!show) return null;

    return (
        <motion.span 
            className="text-xs font-bold ml-1"
            style={{ color: '#ef4444' }}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
        >
            (ignored)
        </motion.span>
    );
}
