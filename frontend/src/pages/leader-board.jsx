import { ChartBarIncreasingIcon } from "lucide-react"

const LeaderBoard = () => {
    return (
        <div className='max-w-7xl mx-auto p-4'>
            <ChartBarIncreasingIcon className="h-6 w-6 text-gray-500 inline-block mb-2" />
            <h2 className='text-2xl font-bold mb-4 inline-block ml-2'>Leader Board</h2>
            <div className='bg-white shadow-md rounded-lg p-6'>
                <p className='text-gray-600'>Leader Board content goes here...</p>
            </div>
        </div>
    )
}

export default LeaderBoard